import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roomTypes = await prisma.roomType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(roomTypes.map((rt) => ({ ...rt, baseRate: Number(rt.baseRate) })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  
  const body = await req.json();
  if (!body.name || body.baseRate === undefined) {
    return NextResponse.json({ error: "Name and base rate are required." }, { status: 400 });
  }

  const roomType = await prisma.roomType.create({
    data: {
      name: body.name,
      description: body.description || null,
      baseRate: body.baseRate,
      capacity: body.capacity || 2,
    },
  });
  return NextResponse.json({ ...roomType, baseRate: Number(roomType.baseRate) }, { status: 201 });
}
