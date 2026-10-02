#!/usr/bin/env node
/**
 * The restore drill, guided.
 *
 * The previous instructions asked you to edit a long connection string by hand,
 * replacing bracketed placeholders. That failed three times, which makes it a bad
 * instruction rather than bad luck - so this script does the editing instead.
 *
 * What it asks for, and why:
 *   1. The connection string exactly as Supabase prints it on the Connect panel,
 *      brackets and all. Copy, paste, enter. No editing.
 *   2. The database password, typed separately. The script inserts and encodes it,
 *      so characters like @ : / ? cannot break the URL.
 *
 * Then it checks the target really is a different project from your live one,
 * proves the connection before touching anything, restores, and compares both
 * databases side by side.
 *
 * Usage:
 *   node scripts/restore-drill.mjs
 *   node scripts/restore-drill.mjs --file "C:\\path\\to\\dump"
 */

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const die = (lines) => {
  say("");
  for (const line of Array.isArray(lines) ? lines : [lines]) say(line);
  say("");
  process.exit(1);
};


/**
 * Input handling, done by hand on purpose.
 *
 * `rl.question()` drops a line that arrives before the prompt is set up. Paste a
 * connection string and hit enter twice quickly and the second answer is swallowed
 * - the script then sits there, and Node exits 0 having done nothing. Silent
 * no-ops in a backup tool are not acceptable, so lines are queued here and handed
 * out in order, and running out of input is an error rather than a shrug.
 */
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
const pending = [];
let waiting = null;
let ended = false;

rl.on("line", (line) => {
  if (waiting) {
    const resolve = waiting;
    waiting = null;
    resolve(line);
  } else {
    pending.push(line);
  }
});
rl.on("close", () => {
  ended = true;
  if (waiting) {
    const resolve = waiting;
    waiting = null;
    resolve(null);
  }
});

async function ask(question, { required = true } = {}) {
  process.stdout.write(question);
  let answer = pending.length > 0 ? pending.shift() : null;
  if (answer === null && !ended) {
    answer = await new Promise((resolve) => {
      waiting = resolve;
    });
  }
  if (answer === null) {
    console.log("");
    die(["  Input ended before that question was answered.", "  Run the command again and answer each prompt."]);
  }
  const trimmed = answer.trim();
  if (required && !trimmed) {
    console.log("");
    die("  Nothing was entered there. Run the command again and answer each prompt.");
  }
  return trimmed;
}

const say = (line = "") => console.log(line);
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

// ── .env ─────────────────────────────────────────────────────────────────────
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

/** Strip Prisma-only options and force TLS for remote hosts, for libpq tools. */
function sanitise(rawUrl) {
  const url = new URL(rawUrl);
  for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"]) {
    url.searchParams.delete(key);
  }
  const host = url.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

// ── Supabase identity ────────────────────────────────────────────────────────
function supabaseRef(url) {
  const parsed = new URL(url);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.(co|in)$/i);
  if (direct) return direct[1];
  const pooled = parsed.username.match(/^postgres\.([a-z0-9]+)$/i);
  if (pooled && /(^|\.)pooler\.supabase\.com$/i.test(parsed.hostname)) return pooled[1];
  return null;
}

const PLACEHOLDER = /[[\]<>]|YOUR-|PROJECT-REF|PROJECT_REF|xxxxxxxx/i;

// ── pg tools ─────────────────────────────────────────────────────────────────
function findPgTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  for (let major = 18; major >= 13; major--) {
    for (const base of ["C:\\Program Files\\PostgreSQL", "C:\\Program Files (x86)\\PostgreSQL"]) {
      const candidate = join(base, String(major), "bin", exe);
      if (existsSync(candidate)) return candidate;
    }
  }
  return name;
}

function psql(url, sql) {
  return spawnSync(findPgTool("psql"), ["--dbname", url, "--no-align", "--tuples-only", "--command", sql], {
    encoding: "utf8",
  });
}

// ── the dump to restore ──────────────────────────────────────────────────────
function findDump(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) die(`  No file at ${explicit}`);
    return resolve(explicit);
  }
  const dirs = [join(ROOT, "backups")];
  const home = process.env.USERPROFILE || process.env.HOME;
  if (home) dirs.unshift(join(home, "OneDrive", "HMS-Backups"));
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const dumps = readdirSync(dir)
      .filter((name) => /^hms-.*\.dump$/.test(name))
      .map((name) => ({ name, path: join(dir, name), time: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    if (dumps.length > 0) return dumps[0].path;
  }
  return null;
}

// ── the queries both databases answer ────────────────────────────────────────
const COUNT_SQL = `
select 'rooms', count(*)::text from "Room"
union all select 'room types', count(*)::text from "RoomType"
union all select 'guests', count(*)::text from "Guest"
union all select 'reservations', count(*)::text from "Reservation"
union all select 'folios', count(*)::text from "Folio"
union all select 'folio items', count(*)::text from "FolioItem"
union all select 'payments', count(*)::text from "Payment"
union all select 'payment methods', count(*)::text from "PaymentMethod"
union all select 'users', count(*)::text from "User"
union all select 'menu items', count(*)::text from "MenuItem"
union all select 'inventory items', count(*)::text from "InventoryItem"
union all select 'total paid', coalesce(sum(amount), 0)::text from "Payment"
`;

function readCounts(url) {
  const result = psql(url, COUNT_SQL);
  if (result.status !== 0) return null;
  const rows = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const [key, value] = line.split("|");
    if (key && value !== undefined) rows[key.trim()] = value.trim();
  }
  return rows;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const env = readEnv();
  const live = env.DIRECT_URL || env.DATABASE_URL;
  if (!live) die("  No DATABASE_URL or DIRECT_URL in .env - run this from your project folder.");
  const liveRef = supabaseRef(live);

  say("");
  say("  Restore drill");
  say("  ────────────");
  say("");
  say("  Your live database reference is:");
  say(`    ${liveRef ?? "(could not be read - check .env)"}`);
  say("");
  say("  The target you are about to restore into MUST be a different one.");
  say("");
  say("  Paste the connection string from Supabase:");
  say("    open the test project -> green Connect button -> Session pooler -> copy");
  say("  Paste it exactly as shown. Brackets and all. Do not edit it.");
  say("");

  const pasted = await ask("  Connection string: ");
  if (!pasted) die("  Nothing pasted.");

  // Accept either a full connection string or a bare project reference.
  let target;
  if (/^postgres(ql)?:\/\//i.test(pasted)) {
    target = pasted;
  } else if (/^[a-z0-9]{16,24}$/i.test(pasted)) {
    target = `postgresql://postgres.${pasted}:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
    say("");
    say("  That looks like a bare reference, so I need the pooler host too - it cannot be guessed.");
    const host = await ask("  Pooler host (e.g. aws-1-eu-west-1.pooler.supabase.com): ");
    target = `postgresql://postgres.${pasted}:[YOUR-PASSWORD]@${host}:5432/postgres`;
  } else {
    die([
      "  That is not a connection string or a project reference.",
      "  Use the green Connect button -> Session pooler -> copy the whole string.",
    ]);
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    die("  That connection string could not be read. Copy it again from the Connect panel.");
  }

  // The password, if the string still has a placeholder - or is obviously the
  // project name, which is a mistake worth catching early.
  let password = decodeURIComponent(parsed.password || "");
  if (!password || PLACEHOLDER.test(password)) {
    say("");
    say("  Database password for the test project.");
    say("  (This is the password you set when creating it. If you did not save it,");
    say("   reset it: Project Settings -> Database -> Reset database password.)");
    say("");
    password = await ask("  Password: ");
  }
  parsed.password = ""; // rebuilt below, encoded
  const built = new URL(parsed.toString());
  built.password = encodeURIComponent(password);
  const targetUrl = built.toString();

  // Guard 1: placeholders that were never replaced.
  if (PLACEHOLDER.test(targetUrl)) {
    say("");
    die([
      "  The string still contains a placeholder:",
      `    ${targetUrl.replace(/:[^:@/]+@/, ":****@")}`,
      "",
      "  Go back to Supabase, click Connect, choose Session pooler, and copy the",
      "  full string. The reference inside it is a real 20-character id such as",
      "  'qwertyuiopasdfghjklz', not the words PROJECT-REF.",
    ]);
  }

  // Guard 2: the same project as live. This is the one that matters.
  const targetRef = supabaseRef(targetUrl);
  if (!targetRef) {
    die([
      "  Could not read a project reference from that string.",
      "  Check the username is postgres.<reference>, not plain postgres.",
    ]);
  }
  if (liveRef && targetRef === liveRef) {
    say("");
    die([
      "  STOP. That is your LIVE database, not the test project.",
      `    live reference:   ${liveRef}`,
      `    target reference: ${targetRef}`,
      "",
      "  Restoring here would replace the hotel's live records with the backup.",
      "  Create the test project and use its string instead.",
    ]);
  }

  say("");
  say("  Live reference:   " + (liveRef ?? "(unknown)"));
  say("  Target reference: " + targetRef);
  say("  Target host:      " + new URL(targetUrl).host);
  say("");

  const dump = findDump(arg("file"));
  if (!dump) {
    die([
      "  No backup found. Look in OneDrive\\HMS-Backups, or pass one:",
      '    node scripts\\restore-drill.mjs --file "C:\\path\\to\\hms-....dump"',
    ]);
  }
  say("  Backup to restore: " + dump);
  const answer = (await ask("\n  Type yes to continue: ")).toLowerCase();
  if (answer !== "yes") die("  Stopped. Nothing was changed.");

  // Preflight: prove the connection before restoring anything.
  say("");
  say("  Checking the connection...");
  const probe = psql(sanitise(targetUrl), "select current_user;");
  if (probe.status !== 0) {
    const message = `${probe.stderr || ""}${probe.stdout || ""}`;
    say("");
    if (/ENOTFOUND.*not found/i.test(message)) {
      die([
        "  That project reference does not exist.",
        `    The pooler looked for: postgres.${targetRef}`,
        "",
        "  Check the test project's reference in the Supabase address bar:",
        "    supabase.com/dashboard/project/<reference>",
        "  It must be that value, not the project's name.",
      ]);
    }
    if (/password authentication failed/i.test(message)) {
      die([
        "  The password is wrong for that project.",
        "  Reset it: Project Settings -> Database -> Reset database password,",
        "  then run this again.",
      ]);
    }
    if (/timed out|10060/i.test(message)) {
      die([
        "  Connection timed out. You are on an IPv4-only network and that string",
        "  points at the Direct connection, which is IPv6-only on the free plan.",
        "  Use Connect -> Session pooler instead (port 5432 on the pooler host).",
      ]);
    }
    if (/tenant identifier/i.test(message)) {
      die("  The username must be postgres.<project-ref>, not plain postgres.");
    }
    die(["  Could not connect:", "", message.trim()]);
  }
  say("  Connected as " + probe.stdout.trim());

  // Restore, reusing the script you already have.
  say("");
  say("  Restoring...");
  say("");
  const restore = spawnSync(
    process.execPath,
    [join(ROOT, "scripts", "restore-db.mjs"), "--file", dump, "--target", targetUrl],
    { stdio: "inherit" }
  );
  if (restore.status !== 0) {
    die("  The restore failed. The messages above explain why. Nothing else was changed.");
  }

  // Compare, side by side.
  say("");
  say("  Comparing the two databases...");
  say("");
  const liveCounts = readCounts(sanitise(live));
  const targetCounts = readCounts(sanitise(targetUrl));
  if (!liveCounts || !targetCounts) {
    say("  Restored, but I could not read the counts back automatically.");
    say("  Paste verification-queries.sql into both projects' SQL Editor and compare.");
    return;
  }

  let differences = 0;
  say("    " + "what".padEnd(18) + "live".padStart(10) + "restored".padStart(12) + "   ");
  say("    " + "-".repeat(46));
  for (const key of Object.keys(targetCounts)) {
    const a = liveCounts[key] ?? "-";
    const b = targetCounts[key];
    const same = a === b;
    if (!same) differences += 1;
    say("    " + key.padEnd(18) + a.padStart(10) + b.padStart(12) + "   " + (same ? "ok" : "DIFFERS"));
  }
  say("");
  if (differences === 0) {
    say("  Every figure matches. Your backup is a working copy of the hotel's records.");
  } else {
    say(`  ${differences} figure(s) differ.`);
    say("  Bookings taken since the backup was made will explain small gaps in");
    say("  reservations, folios and payments. Rooms, room types and users should");
    say("  always match - if those differ, tell me and we will look at the dump.");
  }
  say("");
}

main()
  .catch((error) => die(`  ${error.message}`))
  .finally(() => rl.close());
