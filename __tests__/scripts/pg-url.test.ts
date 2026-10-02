import { describe, it, expect } from "vitest";
import { sanitiseForPgTools } from "../../scripts/pg-url.mjs";

/**
 * Covers the connection-string handling shared by scripts/backup-db.mjs and
 * scripts/restore-db.mjs. Neither script had any test coverage before this.
 *
 * This function decides which database is dumped and, more importantly, which
 * database gets OVERWRITTEN by a restore. The two failure modes it is here to
 * prevent:
 *
 *   1. Passing a Prisma URL straight to pg_dump, which aborts with
 *      "invalid URI query parameter" -- so the nightly backup silently never
 *      runs.
 *   2. Dropping SSL on a remote host, which Supabase refuses.
 *
 * It is also the one piece of these scripts that can be tested without a
 * database and without the real pg_dump binary, which is why it was extracted
 * out of the two copies it used to live in.
 */

/** Re-parse the result so the column of assertions is about the parsed URL. */
const parse = (url: string) => new URL(sanitiseForPgTools(url));

describe("sanitiseForPgTools — Prisma-only parameters", () => {
  it("strips every parameter pg_dump rejects", () => {
    const url =
      "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres" +
      "?schema=public&connection_limit=1&pool_timeout=20&pgbouncer=true&socket_timeout=10";
    const result = parse(url);

    for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"]) {
      expect(result.searchParams.has(key), `${key} should be stripped`).toBe(false);
    }
    // The whole query string should be gone, not just partially cleaned.
    expect(result.search).toBe("?sslmode=require");
  });

  it("keeps parameters that pg_dump does understand", () => {
    // sslmode is deliberately kept, and application_name is harmless.
    const result = parse(
      "postgresql://u:p@db.x.supabase.co:5432/postgres?application_name=backup&options=-c%20statement_timeout%3D0"
    );
    expect(result.searchParams.get("application_name")).toBe("backup");
    expect(result.searchParams.get("options")).toBe("-c statement_timeout=0");
  });

  it("leaves the connection string usable when there is no query string at all", () => {
    const result = parse("postgresql://u:p@db.x.supabase.co:5432/postgres");
    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.hostname).toBe("db.x.supabase.co");
  });
});

describe("sanitiseForPgTools — SSL", () => {
  it("forces sslmode=require on any remote host, because Supabase refuses plaintext", () => {
    for (const host of [
      "db.abcdefgh.supabase.co",
      "aws-0-eu-central-1.pooler.supabase.com",
      "some-other-db.example.com",
    ]) {
      const result = parse(`postgresql://u:p@${host}:5432/postgres`);
      expect(result.searchParams.get("sslmode"), host).toBe("require");
    }
  });

  it("does not force SSL for a local database", () => {
    // A local Postgres usually has no TLS configured; forcing it would turn a
    // working local backup into a hard failure.
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const result = parse(`postgresql://u:p@${host}:5432/hms`);
      expect(result.searchParams.get("sslmode"), host).toBeNull();
    }
  });

  it("recognises IPv6 localhost even though url.hostname keeps the brackets", () => {
    // Regression guard. `new URL("...@[::1]:5432/x").hostname` is "[::1]", not
    // "::1", so a bare `host === "::1"` test never fires and a local IPv6
    // database silently gets sslmode=require. Asserted against `new URL()`
    // directly so the reason is visible if the implementation is ever tidied.
    expect(new URL("postgresql://u:p@[::1]:5432/x").hostname).toBe("[::1]");
    expect(sanitiseForPgTools("postgresql://u:p@[::1]:5432/x")).not.toContain("sslmode");
    // A non-local IPv6 address is still remote, and still gets SSL.
    expect(parse("postgresql://u:p@[2001:db8::1]:5432/x").searchParams.get("sslmode")).toBe("require");
  });

  it("preserves an sslmode that was set deliberately", () => {
    // Including the case of deliberately turning it OFF for a LAN database.
    expect(parse("postgresql://u:p@db.x.supabase.co:5432/d?sslmode=disable").searchParams.get("sslmode")).toBe(
      "disable"
    );
    expect(parse("postgresql://u:p@db.x.supabase.co:5432/d?sslmode=verify-full").searchParams.get("sslmode")).toBe(
      "verify-full"
    );
    // ...and does not add a duplicate.
    const result = parse("postgresql://u:p@db.x.supabase.co:5432/d?sslmode=require");
    expect(result.searchParams.getAll("sslmode")).toEqual(["require"]);
  });
});

describe("sanitiseForPgTools — credentials and shape survive", () => {
  it("keeps the username, password, port and database intact", () => {
    const result = parse("postgresql://postgres.abcdefgh:sup3r-s3cret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres");
    expect(result.username).toBe("postgres.abcdefgh");
    expect(decodeURIComponent(result.password)).toBe("sup3r-s3cret");
    expect(result.port).toBe("6543");
    expect(result.pathname).toBe("/postgres");
  });

  it("handles a percent-encoded password containing @ : / and #", () => {
    // These are the characters that break naive string splitting. Supabase
    // generates passwords from a set that includes them.
    const password = "p%40ss%3Aword%2Fwith%23chars";
    const result = parse(`postgresql://postgres:${password}@db.abcdefgh.supabase.co:5432/postgres`);
    expect(decodeURIComponent(result.password)).toBe("p@ss:word/with#chars");
    expect(result.searchParams.get("sslmode")).toBe("require");
  });

  it("returns a string that is itself a valid URL", () => {
    // pg_dump receives this verbatim, so it has to round-trip.
    const out = sanitiseForPgTools("postgresql://u:p@db.x.supabase.co:5432/postgres?schema=public");
    expect(typeof out).toBe("string");
    expect(() => new URL(out)).not.toThrow();
    expect(new URL(out).protocol).toBe("postgresql:");
  });

  it("is idempotent, so re-sanitising cannot drift", () => {
    const once = sanitiseForPgTools("postgresql://u:p@db.x.supabase.co:5432/postgres?schema=public");
    expect(sanitiseForPgTools(once)).toBe(once);
  });
});

describe("sanitiseForPgTools — bad input fails loudly", () => {
  it("throws on a string that is not a URL", () => {
    // Both scripts rely on this: a malformed connection string must abort,
    // never fall through to some default database.
    for (const bad of ["", "not a url", "http://", "postgres://"]) {
      expect(() => sanitiseForPgTools(bad), JSON.stringify(bad)).toThrow();
    }
  });

  it("rejects a URL that parses but has no host", () => {
    // `new URL()` is permissive in ways that matter here: "postgresql://"
    // parses to an empty host, and a URL that simply lost its scheme --
    // "db.x.supabase.co:5432/postgres" -- parses with protocol
    // "db.x.supabase.co:" and host "". Neither is a database, and silently
    // accepting them means pg_dump/pg_restore failing later with a message
    // that does not point at the actual mistake.
    for (const noHost of ["postgresql://", "db.abcdefgh.supabase.co:5432/postgres"]) {
      expect(() => sanitiseForPgTools(noHost), JSON.stringify(noHost)).toThrow(/no host/i);
    }
  });

  it("never puts the password in an error message", () => {
    // These messages are printed to the console by both scripts, and the URL
    // they were given contains the database password.
    try {
      sanitiseForPgTools("postgresql://postgres:S3CRET-PW@/postgres");
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("S3CRET-PW");
    }
  });
});
