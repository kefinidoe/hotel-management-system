import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ["ADMIN", "MANAGER", "RECEPTIONIST"]);
  if (forbidden) return forbidden;   

  const body = await req.json();
  const roomType = await prisma.roomType.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description || null,
      baseRate: body.baseRate,
      capacity: body.capacity,
    },
  });
  return NextResponse.json({ ...roomType, baseRate: Number(roomType.baseRate) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ["ADMIN", "MANAGER", "RECEPTIONIST"]);
  if (forbidden) return forbidden;

  

  try {
    await prisma.roomType.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Can't delete a room type that still has rooms assigned to it." },
      { status: 400 }
    );
  }
}
