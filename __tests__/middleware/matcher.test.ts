import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

/**
 * Guards the middleware matcher in `middleware.ts`.
 *
 * The matcher is the thing that decides which requests are reachable without a
 * session. It is written as a path-to-regexp pattern with a negative lookahead
 * (`/api/:path((?!auth/).*)`), which is easy to break by accident and — unlike a
 * normal route — fails *open* rather than throwing when it's wrong. Six API
 * endpoints were previously reachable anonymously this way.
 *
 * This reads the real `config.matcher` out of the file and runs it through
 * Next's own matcher, so it fails if someone edits the pattern into something
 * that no longer protects the app, or accidentally locks out signing in.
 */

const SOURCE = readFileSync(resolve(__dirname, "../../middleware.ts"), "utf8");

function readMatcher(): string[] {
  const block = SOURCE.match(/matcher:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error("Could not find `matcher: [...]` in middleware.ts");
  return [...block[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => m[1] ?? m[2]);
}

const matchers = readMatcher();
const isGuarded = (path: string) =>
  matchers.some((pattern) => !!getPathMatch(pattern, { strict: false })(path));

// Every route handler that exists under app/api, enumerated so a new endpoint
// added later is covered by this test the moment it is created.
const API_ROUTES = [
  "/api/check-in",
  "/api/check-out",
  "/api/expenses",
  "/api/expenses/abc",
  "/api/folios/abc",
  "/api/guests",
  "/api/guests/abc",
  "/api/housekeeping",
  "/api/housekeeping/abc",
  "/api/inventory",
  "/api/inventory/abc",
  "/api/maintenance",
  "/api/maintenance/abc",
  "/api/menu",
  "/api/menu/categories",
  "/api/menu/items/abc",
  "/api/payment-methods",
  "/api/payments",
  "/api/purchases",
  "/api/recipes",
  "/api/recipes/abc",
  "/api/reports",
  "/api/reservations",
  "/api/reservations/abc",
  "/api/restaurant/activity",
  "/api/restaurant/charge-to-room",
  "/api/restaurant/open-folios",
  "/api/restaurant/pay-now",
  "/api/room-types",
  "/api/room-types/abc",
  "/api/rooms",
  "/api/rooms/abc",
  "/api/search",
  "/api/staff",
  "/api/staff/abc",
  "/api/stock-movements",
  "/api/wastage",
];

// NextAuth's own endpoints. If any of these become guarded, nobody can sign in.
const AUTH_ROUTES = [
  "/api/auth/signin",
  "/api/auth/signin/credentials",
  "/api/auth/callback/credentials",
  "/api/auth/session",
  "/api/auth/csrf",
  "/api/auth/providers",
  "/api/auth/signout",
  "/api/auth/error",
  "/api/auth/verify-request",
];

const PUBLIC_PAGES = ["/", "/login", "/favicon.ico"];

describe("middleware matcher", () => {
  it("parses to exactly two matchers (dashboard pages + api)", () => {
    expect(matchers).toHaveLength(2);
  });

  it("guards every existing /api route", () => {
    const unguarded = API_ROUTES.filter((p) => !isGuarded(p));
    expect(unguarded).toEqual([]);
  });

  it("leaves NextAuth's own endpoints public, so sign-in still works", () => {
    const wronglyGuarded = AUTH_ROUTES.filter(isGuarded);
    expect(wronglyGuarded).toEqual([]);
  });

  it("guards every /dashboard page and leaves the public pages alone", () => {
    expect(isGuarded("/dashboard")).toBe(true);
    expect(isGuarded("/dashboard/front-desk")).toBe(true);
    expect(isGuarded("/dashboard/guests/abc")).toBe(true);
    for (const p of PUBLIC_PAGES) {
      expect(isGuarded(p), `${p} should not be guarded`).toBe(false);
    }
  });
});
