import { NextResponse } from "next/server";
import { getServerSession, Session } from "next-auth";
import { RoleName } from "@prisma/client";
import { authOptions } from "@/lib/auth";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export function requireRole(session: Session, allowed: RoleName[]) {
  const role = session.user.role;
  if (!allowed.includes(role)) {
    return NextResponse.json(
      { error: "You don't have permission to do that." },
      { status: 403 }
    );
  }
  return null;
}