import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/authz";

// Same endpoint, two shapes: everyone logged in gets the lightweight list
// (used for assignee dropdowns in Housekeeping/Maintenance/etc). Only an
// ADMIN or MANAGER gets the fuller staff-management view -- email,
// department, active status aren't something every staff member needs to
// see about every other staff member.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const role = (auth.user as any).role;
  const isManagement = role === "ADMIN" || role === "MANAGER";

  const staff = await prisma.user.findMany({
    where: isManagement ? undefined : { isActive: true },
    select: isManagement
      ? {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        }
      : { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}

// Create a new staff account. ADMIN only -- a MANAGER can view the roster
// (see GET above) but shouldn't be able to grant anyone, including
// themselves, elevated access.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ["ADMIN"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { name, email, password, role, department, phone } = body as {
    name: string;
    email: string;
    password: string;
    role: string;
    department?: string;
    phone?: string;
  };

  if (!name || !email || !password || !role) {
    return NextResponse.json(
      { error: "Name, email, password, and role are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: role as any, department: department || null, phone: phone || null },
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}