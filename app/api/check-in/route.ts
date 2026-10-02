import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { rangesOverlap } from "@/lib/dates";
import { blocksGuestPlacement, isBookableToday, ROOM_STATUS_LABELS } from "@/lib/room-status";
import {
  accommodationRequired,
  parseMoney,
  roundMoney,
  stayNights,
} from "@/lib/billing";

class CheckInError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
  if (!reservationId) {
    return NextResponse.json({ error: "Reservation is required." }, { status: 400 });
  }

  let amountPaid: number;
  try {
    amountPaid = parseMoney(body.amountPaid ?? 0, "Amount paid", { allowZero: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Amount paid is invalid." },
      { status: 400 }
    );
  }

  const paymentMethodId =
    typeof body.paymentMethodId === "string" ? body.paymentMethodId.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";

  // Optional: the receptionist moved the guest to a different room because the
  // reserved one is dirty, under maintenance, or otherwise unusable.
  const newRoomId = typeof body.newRoomId === "string" ? body.newRoomId.trim() : "";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          include: {
            rooms: { include: { room: true } },
            folios: { select: { id: true } },
          },
        });
        if (!reservation) throw new CheckInError("Reservation not found.", 404);
        if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") {
          throw new CheckInError("Only a pending or confirmed reservation can be checked in.");
        }
        if (reservation.folios.length > 0) {
          throw new CheckInError("This reservation already has a folio and cannot be checked in again.");
        }

        if (newRoomId && reservation.rooms.length > 1) {
          throw new CheckInError(
            "This reservation holds more than one room. Change rooms from the reservation instead."
          );
        }

        // Room change: only into a room that is free and clean, never into one
        // that is occupied, dirty or under maintenance.
        let assignedRoom: { id: string; number: string } | null =
          reservation.rooms[0]?.room ?? null;
        if (newRoomId && newRoomId !== assignedRoom?.id) {
          const target = await tx.room.findUnique({
            where: { id: newRoomId },
            select: { id: true, number: true, status: true, isActive: true },
          });
          if (!target) throw new CheckInError("The room you selected was not found.", 404);
          if (!target.isActive) {
            throw new CheckInError(
              `Room ${target.number} is no longer part of the hotel's active rooms. Choose another.`
            );
          }
          if (!isBookableToday(target.status)) {
            throw new CheckInError(
              `Room ${target.number} is ${ROOM_STATUS_LABELS[target.status]}. Choose an available room.`
            );
          }

          const otherStays = await tx.reservationRoom.findMany({
            where: {
              roomId: target.id,
              reservation: { status: { notIn: ["CANCELLED", "NO_SHOW"] }, id: { not: reservation.id } },
            },
            include: { reservation: true },
          });
          const clash = otherStays.find((stay) =>
            rangesOverlap(
              reservation.checkInDate,
              reservation.checkOutDate,
              stay.reservation.checkInDate,
              stay.reservation.checkOutDate
            )
          );
          if (clash) {
            throw new CheckInError(
              `Room ${target.number} is already booked for these dates. Choose another room.`
            );
          }

          await tx.reservationRoom.update({
            where: { id: reservation.rooms[0].id },
            data: { roomId: target.id },
          });
          assignedRoom = { id: target.id, number: target.number };
        }

        // The guest cannot be put into a room that is unfit, even if the client
        // that sent this request would have allowed it.
        if (assignedRoom) {
          const current = await tx.room.findUnique({
            where: { id: assignedRoom.id },
            select: { status: true, number: true },
          });
          if (current && newRoomId === "" && blocksGuestPlacement(current.status)) {
            throw new CheckInError(
              `Room ${current.number} is ${ROOM_STATUS_LABELS[current.status]}. Choose an available room, or ask housekeeping to finish it first.`
            );
          }
        }

        let nights: number;
        let required: number;
        const discount = Number(reservation.discount ?? 0);
        try {
          nights = stayNights(reservation.checkInDate, reservation.checkOutDate);
          required = accommodationRequired(
            reservation.rooms.map((room) => Number(room.rate)),
            nights,
            discount
          );
        } catch (error) {
          throw new CheckInError(
            error instanceof Error ? error.message : "The accommodation charges are invalid."
          );
        }

        if (amountPaid > required) {
          throw new CheckInError(
            `Amount paid cannot exceed the required amount of KSh ${required.toLocaleString()}.`
          );
        }

        const method = amountPaid > 0
          ? await tx.paymentMethod.findFirst({
              where: { id: paymentMethodId, isActive: true },
            })
          : null;
        if (amountPaid > 0 && !method) {
          throw new CheckInError("Choose an active payment method for the check-in payment.");
        }

        const folio = await tx.folio.create({
          data: { guestId: reservation.guestId, reservationId: reservation.id },
        });

        for (const reservationRoom of reservation.rooms) {
          const unitPrice = Number(reservationRoom.rate);
          const roomNumber =
            assignedRoom && reservationRoom.roomId === reservation.rooms[0]?.roomId
              ? assignedRoom.number
              : reservationRoom.room.number;
          await tx.folioItem.create({
            data: {
              folioId: folio.id,
              type: "ROOM_CHARGE",
              description: `Room ${roomNumber} — ${nights} night(s)`,
              quantity: nights,
              unitPrice,
              taxRate: 0,
              total: roundMoney(unitPrice * nights),
            },
          });
        }

        if (discount > 0) {
          await tx.folioItem.create({
            data: {
              folioId: folio.id,
              type: "DISCOUNT",
              description: "Discount",
              quantity: 1,
              unitPrice: discount,
              taxRate: 0,
              total: -discount,
            },
          });
        }

        if (amountPaid > 0 && method) {
          await tx.payment.create({
            data: {
              folioId: folio.id,
              paymentMethodId: method.id,
              amount: amountPaid,
              reference: reference || null,
              status: "COMPLETED",
              cashierId: session.user.id,
            },
          });
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: "CHECKED_IN",
            paymentMode: method?.name ?? reservation.paymentMode,
          },
        });

        for (const reservationRoom of reservation.rooms) {
          const roomId =
            assignedRoom && reservationRoom.roomId === reservation.rooms[0]?.roomId
              ? assignedRoom.id
              : reservationRoom.roomId;
          await tx.room.update({
            where: { id: roomId },
            data: { status: "OCCUPIED" },
          });
        }

        return {
          folioId: folio.id,
          required,
          paid: amountPaid,
          balance: roundMoney(required - amountPaid),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof CheckInError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "This reservation changed while checking in. Refresh and try again." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not check in the guest." }, { status: 500 });
  }
}
