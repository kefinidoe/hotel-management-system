/**
 * The connection-string handling shared by scripts/backup-db.mjs and
 * scripts/restore-db.mjs.
 *
 * `sanitiseForPgTools` lived as two separate copies, one in each script. They
 * were behaviourally identical, but that is exactly how the `round2`/`roundMoney`
 * divergence started: two implementations of one rule, which stay in step only
 * until someone edits one of them. Since this decides *which database gets
 * dumped* and *which database gets overwritten*, it should be one thing.
 *
 * Note: `sameDatabase()` is deliberately NOT here. restore-db.mjs has a more
 * careful version that understands Supabase project references -- two different
 * projects share one pooler hostname, so comparing host:port alone would report
 * two unrelated databases as identical. That logic stays where the knowledge is.
 *
 * Plain `.mjs` on purpose: the scripts run as `node scripts/backup-db.mjs`, with
 * no TypeScript loader. Node resolves a relative `.mjs` import natively.
 */

const PRISMA_ONLY_PARAMS = [
  "schema",
  "connection_limit",
  "pool_timeout",
  "pgbouncer",
  "socket_timeout",
];

/**
 * The connection string the app uses is a Prisma URL, which carries options that
 * only Prisma understands (`schema`, `connection_limit`, `pgbouncer`...). Handing
 * those straight to pg_dump fails with "invalid URI query parameter". Strip them
 * and make sure SSL is on for any remote host, since Supabase refuses plaintext.
 *
 * An existing `sslmode` is preserved, so a deliberately non-SSL local or LAN
 * database still works.
 *
 * Throws if `rawUrl` is not a parseable URL -- a malformed string here would
 * otherwise mean backing up, or restoring to, something unintended.
 */
export function sanitiseForPgTools(rawUrl) {
  const url = new URL(rawUrl);

  // A URL with no hostname is not a database. `new URL()` accepts surprising
  // things: "postgresql://" parses to an empty host, and a string that merely
  // lost its scheme -- "db.x.supabase.co:5432/postgres" -- parses with
  // protocol "db.x.supabase.co:" and no host at all. Both would otherwise sail
  // through and fail later inside pg_dump/pg_restore with a confusing message.
  //
  // This matters most for the restore script, whose job is to refuse to write
  // to the wrong database.
  //
  // The error deliberately does NOT include the raw URL: it contains the
  // password, and these messages go to the console.
  if (!url.hostname) {
    throw new Error(
      "The connection string has no host. It should start with postgresql:// followed by the host."
    );
  }

  for (const key of PRISMA_ONLY_PARAMS) url.searchParams.delete(key);

  // Strip the brackets from an IPv6 literal. `new URL("...@[::1]:5432/x").hostname`
  // returns "[::1]", not "::1" -- so a bare `host === "::1"` comparison can never
  // match, and a local IPv6 database would be handed sslmode=require and fail
  // against a server with no TLS configured.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal && !url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}
