import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/dates";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { accommodationRequired, parseMoney, stayNights } from "@/lib/billing";
import { nextReservationCode } from "@/lib/reservation-code";

const BOOKING_SOURCES = ["WALK_IN", "PHONE", "WEBSITE", "OTA", "CORPORATE", "OTHER"] as const;

class ReservationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

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
    reservations.map((reservation) => ({
      id: reservation.id,
      code: reservation.code,
      status: reservation.status,
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
      guestName: reservation.guest.fullName,
      guestPhone: reservation.guest.phone,
      rooms: reservation.rooms.map((reservationRoom) => ({
        roomId: reservationRoom.roomId,
        roomNumber: reservationRoom.room.number,
        rate: Number(reservationRoom.rate),
      })),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const guestName = text(body.guestName);
  const guestPhone = text(body.guestPhone);
  const guestEmail = text(body.guestEmail);
  const idNumber = text(body.idNumber);
  const nationality = text(body.nationality);
  const vehicleRegistration = text(body.vehicleRegistration);
  const roomId = text(body.roomId);
  const notes = text(body.notes);

  if (!guestName || !body.checkInDate || !body.checkOutDate || !roomId) {
    return NextResponse.json({ error: "Missing required reservation fields." }, { status: 400 });
  }

  const checkIn = new Date(body.checkInDate);
  const checkOut = new Date(body.checkOutDate);
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime())) {
    return NextResponse.json({ error: "Enter valid check-in and check-out dates." }, { status: 400 });
  }

  let rate: number;
  let discount: number;
  let nights: number;
  try {
    rate = parseMoney(body.rate, "Nightly rate", { allowZero: true });
    discount = parseMoney(body.discount ?? 0, "Discount", { allowZero: true });
    nights = stayNights(checkIn, checkOut);
    accommodationRequired([rate], nights, discount);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The reservation charges are invalid." },
      { status: 400 }
    );
  }

  const adults = Number(body.adults ?? 1);
  const children = Number(body.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
    return NextResponse.json(
      { error: "Adults and children must be valid whole numbers." },
      { status: 400 }
    );
  }

  const source = BOOKING_SOURCES.find((value) => value === body.source) ?? "WALK_IN";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Serialize reservation creation across app instances. This protects
        // both the sequential code and the room-overlap check from races.
        await tx.$queryRaw<Array<{ locked: string }>>`
          SELECT pg_advisory_xact_lock(hashtext('axis-hotel-reservation-create'))::text AS locked
        `;

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true },
        });
        if (!room) throw new ReservationError("Room not found.", 404);

        const existing = await tx.reservationRoom.findMany({
          where: {
            roomId,
            reservation: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          },
          include: { reservation: true },
        });
        const conflict = existing.find((reservationRoom) =>
          rangesOverlap(
            checkIn,
            checkOut,
            reservationRoom.reservation.checkInDate,
            reservationRoom.reservation.checkOutDate
          )
        );
        if (conflict) {
          throw new ReservationError(
            `Room is already booked for part of that date range (${conflict.reservation.code}).`,
            409
          );
        }

        // Guest and reservation writes share one transaction. If anything
        // fails, no unused guest record is left behind.
        const existingGuest = guestPhone
          ? await tx.guest.findFirst({ where: { phone: guestPhone } })
          : null;
        const guest = existingGuest
          ? await tx.guest.update({
              where: { id: existingGuest.id },
              data: {
                idNumber: idNumber || existingGuest.idNumber,
                nationality: nationality || existingGuest.nationality,
                vehicleRegistration: vehicleRegistration || existingGuest.vehicleRegistration,
                email: guestEmail || existingGuest.email,
              },
            })
          : await tx.guest.create({
              data: {
                fullName: guestName,
                phone: guestPhone || null,
                email: guestEmail || null,
                idNumber: idNumber || null,
                nationality: nationality || null,
                vehicleRegistration: vehicleRegistration || null,
              },
            });

        const year = checkIn.getUTCFullYear();
        const prefix = `RES-${year}-`;
        const existingCodes = await tx.reservation.findMany({
          where: { code: { startsWith: prefix } },
          select: { code: true },
        });
        const code = nextReservationCode(
          year,
          existingCodes.map((reservation) => reservation.code)
        );

        const reservation = await tx.reservation.create({
          data: {
            code,
            guestId: guest.id,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            status: "CONFIRMED",
            source,
            adults,
            children,
            discount: discount || null,
            notes: notes || null,
            createdById: session.user.id,
            rooms: { create: [{ roomId: room.id, rate }] },
          },
        });

        return { id: reservation.id, code: reservation.code };
      },
      { timeout: 15_000 }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return NextResponse.json(
        { error: "Another reservation was saved at the same time. Please try again." },
        { status: 409 }
      );
    }
    console.error("Reservation creation failed:", error);
    return NextResponse.json({ error: "Could not create the reservation." }, { status: 500 });
  }
}
