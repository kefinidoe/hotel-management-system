#!/usr/bin/env node
/**
 * Nightly database backup.
 *
 * Supabase's free plan has no automatic backups and no point-in-time recovery,
 * so this script is the only thing standing between a bad delete and losing the
 * hotel's books. It runs pg_dump in custom format (compressed, and restorable
 * without recreating the database first), checks the result is a valid archive
 * rather than trusting the exit code, then removes all but the most recent
 * copies.
 *
 * Usage:
 *   node scripts/backup-db.mjs                 # uses DATABASE_URL / DIRECT_URL from .env
 *   node scripts/backup-db.mjs --url "postgresql://..."
 *   node scripts/backup-db.mjs --keep 60       # how many dumps to retain (default 30)
 *   node scripts/backup-db.mjs --out D:\hms-backups
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitiseForPgTools } from "./pg-url.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── tiny arg parser ───────────────────────────────────────────────────────────
function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

// ── .env ──────────────────────────────────────────────────────────────────────
function readEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

// ── finding pg_dump ───────────────────────────────────────────────────────────
function findPgTool(name) {
  // Common Windows install locations, so nobody has to edit their PATH.
  const windowsCandidates = [];
  for (let major = 17; major >= 13; major--) {
    windowsCandidates.push(`C:\\Program Files\\PostgreSQL\\${major}\\bin\\${name}.exe`);
  }
  for (const candidate of windowsCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  return name; // fall back to PATH
}

function run(command, args, { quiet = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) =>
      reject(new Error(`Could not run ${command}: ${error.message}`))
    );
    child.on("close", (code) => {
      if (code !== 0 && !quiet) {
        reject(new Error(`${command} exited with code ${code}\n${stderr.trim()}`));
      } else {
        resolvePromise({ code, stdout, stderr });
      }
    });
  });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const env = readEnv();
  const keep = Number(arg("keep", "30"));
  const outDir = resolve(ROOT, arg("out", "backups"));

  const rawUrl = arg("url") ?? env.DIRECT_URL ?? env.DATABASE_URL;
  if (!rawUrl) {
    console.error("No database URL found. Set DATABASE_URL in .env, or pass --url.");
    process.exit(1);
  }

  const connection = sanitiseForPgTools(rawUrl);
  const host = new URL(rawUrl).hostname;

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(outDir, `hms-${stamp}.dump`);
  const pgDump = findPgTool("pg_dump");

  console.log("");
  console.log("  Backing up the hotel database");
  console.log(`    from: ${host}`);
  console.log(`    to:   ${file}`);

  const started = Date.now();

  // --schema=public: everything the hotel owns. Supabase's own schemas (auth,
  // storage) are managed by them and cannot be restored into another project.
  const args = [
    "--dbname", connection,
    "--format=custom",
    "--schema=public",
    "--no-owner",
    "--no-privileges",
    "--file", file,
  ];

  try {
    await run(pgDump, args);
  } catch (error) {
    if (/not recognized|cannot find|Could not run|ENOENT/i.test(error.message)) {
      console.error("");
      console.error("  pg_dump was not found on this machine.");
      console.error("  Install the PostgreSQL client tools, then run this again:");
      console.error("    winget install PostgreSQL.PostgreSQL.17");
      console.error("  (or download it from https://www.postgresql.org/download/windows/)");
      console.error("");
      process.exit(1);
    }
    if (existsSync(file)) unlinkSync(file);
    console.error("");
    console.error("  Backup FAILED — nothing was written.");
    console.error(`  ${error.message}`);
    console.error("");
    process.exit(1);
  }

  // Trust the archive, not the exit code: a truncated dump leaves an unusable
  // file behind, and that is worse than no file because it looks like a backup.
  const size = existsSync(file) ? statSync(file).size : 0;
  if (size < 2048) {
    if (existsSync(file)) unlinkSync(file);
    console.error(`  Backup FAILED — the dump came out ${size} bytes, which means it is empty.`);
    console.error("  The incomplete file has been deleted so it cannot be mistaken for a backup.");
    process.exit(1);
  }

  const listing = await run(findPgTool("pg_restore"), ["--list", file]);
  const entries = listing.stdout.split(/\r?\n/).filter((line) => /^\d+;/.test(line)).length;
  if (entries === 0) {
    unlinkSync(file);
    console.error("  Backup FAILED — the dump is not a readable archive.");
    console.error("  The broken file has been deleted so it cannot be mistaken for a backup.");
    process.exit(1);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`    ${(size / 1024).toFixed(0)} KB, ${entries} objects, ${seconds}s — verified OK`);

  // ── retention ───────────────────────────────────────────────────────────────
  const dumps = readdirSync(outDir)
    .filter((name) => /^hms-.*\.dump$/.test(name))
    .sort()
    .reverse();

  const removed = [];
  for (const name of dumps.slice(keep)) {
    unlinkSync(join(outDir, name));
    removed.push(name);
  }
  if (removed.length > 0) console.log(`    removed ${removed.length} old dump(s), keeping ${keep}`);

  console.log("");
  console.log(`  Done. ${dumps.length - removed.length} backup(s) in ${outDir}`);
  console.log("");

  // Say whether the golden rule is actually met. A dump sitting inside the
  // project folder dies with this PC; one in a synced folder leaves the building.
  const CLOUD_SYNC = /onedrive|dropbox|google ?drive|icloud|sharepoint|box\.com|mega\.nz|pcloud/i;
  if (CLOUD_SYNC.test(outDir)) {
    console.log("  Stored in a cloud-synced folder, so a copy leaves this PC.");
    console.log("  Make sure the sync has finished before you rely on it.");
  } else {
    console.log("  A backup that lives only on this PC is not a real backup.");
    console.log("  Point --out at a OneDrive or Google Drive folder so a copy leaves the building.");
  }
  console.log("");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
