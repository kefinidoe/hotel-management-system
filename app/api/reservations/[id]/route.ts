import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/dates";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { stayNights } from "@/lib/billing";
import {
  canTransitionReservation,
  isReservationStatus,
} from "@/lib/reservation-status";

class ReservationUpdateError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function retryWriteConflict<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const canRetry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 3;
      if (!canRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw new Error("Reservation update retry limit reached.");
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const hasStatusChange = body.status !== undefined;
  const hasScheduleChange =
    body.checkInDate !== undefined ||
    body.checkOutDate !== undefined ||
    body.roomId !== undefined;

  if (hasStatusChange && hasScheduleChange) {
    return NextResponse.json(
      { error: "Change reservation status and schedule in separate actions." },
      { status: 400 }
    );
  }
  if (!hasStatusChange && !hasScheduleChange) {
    return NextResponse.json(
      { error: "No supported reservation changes were provided." },
      { status: 400 }
    );
  }
  if (hasStatusChange && !isReservationStatus(body.status)) {
    return NextResponse.json({ error: "Reservation status is invalid." }, { status: 400 });
  }

  try {
    const result = await retryWriteConflict(() =>
      prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw<Array<{ locked: string }>>`
            SELECT pg_advisory_xact_lock(hashtext('axis-hotel-reservation-create'))::text AS locked
          `;

          const reservation = await tx.reservation.findUnique({
            where: { id },
            include: { rooms: { include: { room: true } } },
          });
          if (!reservation) throw new ReservationUpdateError("Reservation not found.", 404);

          if (hasStatusChange && isReservationStatus(body.status)) {
            if (!canTransitionReservation(reservation.status, body.status)) {
              throw new ReservationUpdateError(
                `Reservation cannot change from ${reservation.status} to ${body.status}. Use the dedicated check-in or checkout workflow when applicable.`
              );
            }

            const updated = await tx.reservation.update({
              where: { id: reservation.id },
              data: { status: body.status },
            });
            return { id: updated.id, status: updated.status };
          }

          if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") {
            throw new ReservationUpdateError(
              "Only a pending or confirmed reservation can be rescheduled. Manage an active stay from Front Desk."
            );
          }
          if (reservation.rooms.length !== 1) {
            throw new ReservationUpdateError(
              "This reservation's room assignment requires manager review before rescheduling."
            );
          }

          const checkIn =
            body.checkInDate === undefined
              ? reservation.checkInDate
              : new Date(body.checkInDate);
          const checkOut =
            body.checkOutDate === undefined
              ? reservation.checkOutDate
              : new Date(body.checkOutDate);
          const roomId =
            body.roomId === undefined
              ? reservation.rooms[0].roomId
              : typeof body.roomId === "string"
              ? body.roomId.trim()
              : "";

          if (
            !Number.isFinite(checkIn.getTime()) ||
            !Number.isFinite(checkOut.getTime()) ||
            !roomId
          ) {
            throw new ReservationUpdateError("Enter valid reservation dates and room.");
          }
          try {
            stayNights(checkIn, checkOut);
          } catch (error) {
            throw new ReservationUpdateError(
              error instanceof Error ? error.message : "The reservation dates are invalid."
            );
          }

          const targetRoom = await tx.room.findUnique({
            where: { id: roomId },
            select: { id: true, number: true, isTwin: true },
          });
          if (!targetRoom) throw new ReservationUpdateError("Room not found.", 404);
          if (targetRoom.isTwin !== reservation.rooms[0].room.isTwin) {
            throw new ReservationUpdateError(
              "A reservation cannot move between Twin and Single/Double rooms without creating a new correctly priced reservation."
            );
          }

          const existing = await tx.reservationRoom.findMany({
            where: {
              roomId,
              reservation: {
                id: { not: reservation.id },
                status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
              },
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
            throw new ReservationUpdateError(
              `Room ${targetRoom.number} is already booked for part of those dates (${conflict.reservation.code}).`,
              409
            );
          }

          await tx.reservation.update({
            where: { id: reservation.id },
            data: { checkInDate: checkIn, checkOutDate: checkOut },
          });
          if (roomId !== reservation.rooms[0].roomId) {
            await tx.reservationRoom.update({
              where: { id: reservation.rooms[0].id },
              data: { roomId },
            });
          }

          return {
            id: reservation.id,
            status: reservation.status,
            checkInDate: checkIn.toISOString(),
            checkOutDate: checkOut.toISOString(),
            roomId,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15_000,
        }
      )
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReservationUpdateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The reservation changed at the same time. Refresh and try again." },
        { status: 409 }
      );
    }
    console.error("Reservation update failed:", error);
    return NextResponse.json({ error: "Could not update the reservation." }, { status: 500 });
  }
}
