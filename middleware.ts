import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Blanket guard for the whole authenticated app.
 *
 * Two matchers, because the two kinds of unauthenticated request need
 * different answers:
 *
 *   /dashboard/*  -> a browser, so redirect to /login (keeping where they
 *                    were headed in ?callbackUrl)
 *   /api/*        -> a fetch() from a client component, so a redirect would
 *                    be followed silently and the caller would try to parse
 *                    the login page as JSON. Return a real 401 instead.
 *
 * /api/auth/* (NextAuth's own sign-in endpoints) is deliberately excluded by
 * the matcher below -- guarding it would make signing in impossible.
 *
 * This does NOT replace the per-route checks in lib/authz.ts. Those still own
 * authorisation (which role may do what); this only guarantees that no
 * endpoint is reachable anonymously if someone forgets a check.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    // every /api/* route except /api/auth/* (negative lookahead)
    "/api/:path((?!auth/).*)",
  ],
};
