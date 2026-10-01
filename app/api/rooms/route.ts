import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    include: { roomType: true },
    orderBy: { number: "asc" },
  });
  return NextResponse.json(
    rooms.map((r) => ({
      ...r,
      roomType: { ...r.roomType, baseRate: Number(r.roomType.baseRate) },
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  if (!body.number || !body.roomTypeId) {
    return NextResponse.json(
      { error: "Room number and room type are required." },
      { status: 400 }
    );
  }

  try {
    const room = await prisma.room.create({
      data: { number: body.number, floor: body.floor || null, roomTypeId: body.roomTypeId },
      include: { roomType: true },
    });
    return NextResponse.json(room, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A room with that number already exists." }, { status: 400 });
  }
}
