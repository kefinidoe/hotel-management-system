import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function getCleanSecret(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/^NEXTAUTH_SECRET\s*=\s*/i, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

export async function middleware(req: NextRequest) {
  const secret = getCleanSecret(process.env.NEXTAUTH_SECRET);
  let token = await getToken({
    req,
    secret,
    secureCookie: req.nextUrl.protocol === "https:",
  });
  if (!token) {
    token = await getToken({ req, secret });
  }
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
    "/api/:path((?!auth/).*)",
  ],
};
