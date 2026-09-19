import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const room = await prisma.room.update({
    where: { id: params.id },
    data: {
      number: body.number,
      floor: body.floor ?? null,
      roomTypeId: body.roomTypeId,
      status: body.status,
      notes: body.notes ?? null,
    },
    include: { roomType: true },
  });
  return NextResponse.json(room);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.room.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Can't delete a room that has reservations or history." },
      { status: 400 }
    );
  }
}
