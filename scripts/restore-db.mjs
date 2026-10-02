#!/usr/bin/env node
/**
 * Restore a backup produced by scripts/backup-db.mjs.
 *
 * Deliberately awkward to fire off by accident: it refuses to run without an
 * explicit target, refuses if that target is the same database the app is
 * configured to use unless you say --force, and drops the existing objects in
 * that target so the restore is a clean replacement rather than a merge.
 *
 * Usage:
 *   node scripts/restore-db.mjs --file backups\hms-2026-10-02T21-00-00.dump --target "postgresql://..."
 *   node scripts/restore-db.mjs --file ... --target ... --force      # allow the live URL
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function readEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

export function sanitiseForPgTools(rawUrl) {
  const url = new URL(rawUrl);
  for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"]) {
    url.searchParams.delete(key);
  }
  const host = url.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

function identity(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => reject(new Error(`Could not run ${command}: ${error.message}`)));
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

function findPgTool(name) {
  for (let major = 17; major >= 13; major--) {
    const candidate = `C:\\Program Files\\PostgreSQL\\${major}\\bin\\${name}.exe`;
    if (existsSync(candidate)) return candidate;
  }
  return name;
}

async function main() {
  const env = readEnv();
  const file = arg("file");
  const target = arg("target");

  if (!file) {
    console.error("Pass --file <path to .dump>");
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`No such backup file: ${file}`);
    process.exit(1);
  }
  if (!target) {
    console.error("");
    console.error("  Pass --target with the database to restore INTO, for example:");
    console.error('    --target "postgresql://postgres:...@localhost:5432/hms_restore_test"');
    console.error("");
    console.error("  To test a backup without touching anything live, restore into a");
    console.error("  scratch database or a second Supabase project.");
    console.error("");
    process.exit(1);
  }

  const live = env.DIRECT_URL ?? env.DATABASE_URL;
  if (live && identity(live) === identity(target) && !hasFlag("force")) {
    console.error("");
    console.error("  REFUSING TO RUN.");
    console.error(`  That target is the database this app is configured to use (${identity(live)}).`);
    console.error("  Restoring replaces its contents with the contents of the backup.");
    console.error("");
    console.error("  If that is genuinely what you want, re-run with --force.");
    console.error("");
    process.exit(1);
  }

  const size = statSync(file).size;
  console.log("");
  console.log("  Restoring backup");
  console.log(`    file:   ${file} (${(size / 1024).toFixed(0)} KB)`);
  console.log(`    target: ${identity(target)}`);
  console.log("");
  console.log("  Everything currently in that target will be replaced.");
  console.log("");

  const connection = sanitiseForPgTools(target);
  const pgRestore = findPgTool("pg_restore");

  // --clean --if-exists drops existing objects first, so the result is exactly
  // the backup rather than a mixture of the two.
  const { stderr } = await run(pgRestore, [
    "--dbname", connection,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    file,
  ]);

  // pg_restore prints warnings for objects it could not drop on a first restore
  // (a fresh database has nothing to drop); those are expected and harmless.
  const problems = stderr
    .split(/\r?\n/)
    .filter((line) => /error:/i.test(line) && !/does not exist, skipping/i.test(line));

  if (problems.length > 0) {
    console.error("  Restore reported problems:");
    for (const line of problems.slice(0, 10)) console.error(`    ${line}`);
    process.exit(1);
  }

  console.log("  Restore finished with no errors.");
  console.log("");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
