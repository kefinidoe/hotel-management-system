import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/dates";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { rooms: true },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  // Status-only change (e.g. cancel) — no overlap check needed.
  if (body.status && !body.checkInDate && !body.checkOutDate && !body.roomId) {
    const updated = await prisma.reservation.update({
      where: { id: params.id },
      data: { status: body.status },
    });
    return NextResponse.json({ id: updated.id, status: updated.status });
  }

  const checkIn = body.checkInDate ? new Date(body.checkInDate) : reservation.checkInDate;
  const checkOut = body.checkOutDate ? new Date(body.checkOutDate) : reservation.checkOutDate;
  const roomId = body.roomId || reservation.rooms[0]?.roomId;

  if (checkOut <= checkIn) {
    return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  }

  const existing = await prisma.reservationRoom.findMany({
    where: {
      roomId,
      reservation: { id: { not: params.id }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    },
    include: { reservation: true },
  });
  const conflict = existing.find((rr) =>
    rangesOverlap(checkIn, checkOut, rr.reservation.checkInDate, rr.reservation.checkOutDate)
  );
  if (conflict) {
    return NextResponse.json(
      { error: `That room is already booked for part of those dates (${conflict.reservation.code}).` },
      { status: 409 }
    );
  }

  await prisma.reservation.update({
    where: { id: params.id },
    data: { checkInDate: checkIn, checkOutDate: checkOut },
  });

  if (body.roomId && reservation.rooms[0]) {
    await prisma.reservationRoom.update({
      where: { id: reservation.rooms[0].id },
      data: { roomId: body.roomId },
    });
  }

  return NextResponse.json({ ok: true });
}
