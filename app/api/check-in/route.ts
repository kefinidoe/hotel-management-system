import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireRole(session, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const { reservationId } = await req.json();
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { rooms: { include: { room: true } }, guest: true },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (reservation.status === "CHECKED_IN") {
    return NextResponse.json({ error: "This reservation is already checked in." }, { status: 400 });
  }

  const nights = Math.max(
    1,
    Math.round((reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86400000)
  );

  await prisma.$transaction(async (tx) => {
    const folio = await tx.folio.create({
      data: { guestId: reservation.guestId, reservationId: reservation.id },
    });

    for (const rr of reservation.rooms) {
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          type: "ROOM_CHARGE",
          description: `Room ${rr.room.number} — ${nights} night(s)`,
          quantity: nights,
          unitPrice: rr.rate,
          taxRate: 0,
          total: Number(rr.rate) * nights,
        },
      });
      await tx.room.update({ where: { id: rr.roomId }, data: { status: "OCCUPIED" } });
    }

    if (reservation.discount && Number(reservation.discount) > 0) {
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          type: "DISCOUNT",
          description: "Discount",
          quantity: 1,
          unitPrice: Number(reservation.discount),
          taxRate: 0,
          total: -Number(reservation.discount),
        },
      });
    }

    await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CHECKED_IN" } });
  });

  return NextResponse.json({ ok: true });
}
