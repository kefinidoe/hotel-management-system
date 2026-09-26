import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    

  const { reservationId } = await req.json();
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { rooms: true, folios: { include: { items: true, payments: true } } },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  const openFolio = reservation.folios.find((f) => !f.isClosed);

  await prisma.$transaction(async (tx) => {
    if (openFolio) {
      await tx.folio.update({ where: { id: openFolio.id }, data: { isClosed: true } });
    }
    await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CHECKED_OUT" } });

    for (const rr of reservation.rooms) {
      await tx.room.update({ where: { id: rr.roomId }, data: { status: "DIRTY" } });
      await tx.housekeepingTask.create({
        data: { roomId: rr.roomId, status: "NEEDS_CLEANING", priority: "normal" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
