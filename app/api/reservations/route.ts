import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/dates";
import { requireAuth, requireRole } from "@/lib/authz";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const reservations = await prisma.reservation.findMany({
    where:
      from && to
        ? {
            AND: [
              { checkInDate: { lt: new Date(to) } },
              { checkOutDate: { gt: new Date(from) } },
            ],
          }
        : undefined,
    include: { guest: true, rooms: { include: { room: true } } },
    orderBy: { checkInDate: "asc" },
  });

  return NextResponse.json(
    reservations.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      checkInDate: r.checkInDate.toISOString(),
      checkOutDate: r.checkOutDate.toISOString(),
      guestName: r.guest.fullName,
      guestPhone: r.guest.phone,
      rooms: r.rooms.map((rr) => ({
        roomId: rr.roomId,
        roomNumber: rr.room.number,
        rate: Number(rr.rate),
      })),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireRole(session, ["ADMIN", "MANAGER", "RECEPTIONIST"]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const {
    guestName,
    guestPhone,
    guestEmail,
    idNumber,
    nationality,
    vehicleRegistration,
    checkInDate,
    checkOutDate,
    roomId,
    rate,
    adults,
    children,
    source,
    notes,
    paymentMode,
    discount,
  } = body;

  if (!guestName || !checkInDate || !checkOutDate || !roomId || rate === undefined) {
    return NextResponse.json({ error: "Missing required reservation fields." }, { status: 400 });
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (checkOut <= checkIn) {
    return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  }

  // Prevent double-booking: look at every active reservation on this room and check for overlap.
  const existing = await prisma.reservationRoom.findMany({
    where: {
      roomId,
      reservation: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    },
    include: { reservation: true },
  });
  const conflict = existing.find((rr) =>
    rangesOverlap(checkIn, checkOut, rr.reservation.checkInDate, rr.reservation.checkOutDate)
  );
  if (conflict) {
    return NextResponse.json(
      { error: `Room is already booked for part of that date range (${conflict.reservation.code}).` },
      { status: 409 }
    );
  }

  // Find guest by phone, otherwise create a new one. Update any newly-provided
  // registration details (ID, nationality, vehicle reg) on an existing guest too.
  let guest = guestPhone
    ? await prisma.guest.findFirst({ where: { phone: guestPhone } })
    : null;
  if (guest) {
    guest = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        idNumber: idNumber || guest.idNumber,
        nationality: nationality || guest.nationality,
        vehicleRegistration: vehicleRegistration || guest.vehicleRegistration,
        email: guestEmail || guest.email,
      },
    });
  } else {
    guest = await prisma.guest.create({
      data: {
        fullName: guestName,
        phone: guestPhone || null,
        email: guestEmail || null,
        idNumber: idNumber || null,
        nationality: nationality || null,
        vehicleRegistration: vehicleRegistration || null,
      },
    });
  }

  const year = checkIn.getFullYear();
  const count = await prisma.reservation.count({ where: { code: { startsWith: `RES-${year}-` } } });
  const code = `RES-${year}-${String(count + 1).padStart(5, "0")}`;

  const reservation = await prisma.reservation.create({
    data: {
      code,
      guestId: guest.id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      status: "CONFIRMED",
      source: source || "WALK_IN",
      adults: adults || 1,
      children: children || 0,
      paymentMode: paymentMode || null,
      discount: discount ? Number(discount) : null,
      notes: notes || null,
      createdById: session.user.id,
      rooms: { create: [{ roomId, rate }] },
    },
  });

  return NextResponse.json({ id: reservation.id, code: reservation.code }, { status: 201 });
}
