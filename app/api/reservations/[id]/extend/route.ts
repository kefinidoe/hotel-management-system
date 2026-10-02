import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { folioTotals, roundMoney, stayNights } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { formatDisplayDate } from "@/lib/dates";

class ExtensionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const newCheckOut = new Date(body.checkOutDate);
  if (!Number.isFinite(newCheckOut.getTime())) {
    return NextResponse.json({ error: "Choose a valid new check-out date." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Use the same transaction lock as reservation creation so a new
        // booking cannot take the extension dates during this operation.
        await tx.$queryRaw<Array<{ locked: string }>>`
          SELECT pg_advisory_xact_lock(hashtext('axis-hotel-reservation-create'))::text AS locked
        `;

        const reservation = await tx.reservation.findUnique({
          where: { id },
          include: {
            rooms: { include: { room: true } },
            folios: {
              where: { isClosed: false },
              include: {
                items: { select: { total: true } },
                payments: {
                  where: { status: "COMPLETED" },
                  select: { amount: true },
                },
              },
            },
          },
        });
        if (!reservation) throw new ExtensionError("Reservation not found.", 404);
        if (reservation.status !== "CHECKED_IN") {
          throw new ExtensionError("Only a checked-in stay can be extended.");
        }
        if (reservation.rooms.length === 0) {
          throw new ExtensionError("This stay has no assigned room.");
        }
        if (newCheckOut <= reservation.checkOutDate) {
          throw new ExtensionError("The new check-out date must be after the current date.");
        }

        let additionalNights: number;
        try {
          additionalNights = stayNights(reservation.checkOutDate, newCheckOut);
        } catch (error) {
          throw new ExtensionError(
            error instanceof Error ? error.message : "The extension dates are invalid."
          );
        }

        const roomIds = reservation.rooms.map((reservationRoom) => reservationRoom.roomId);
        const conflict = await tx.reservationRoom.findFirst({
          where: {
            roomId: { in: roomIds },
            reservation: {
              id: { not: reservation.id },
              status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
              checkInDate: { lt: newCheckOut },
              checkOutDate: { gt: reservation.checkOutDate },
            },
          },
          include: {
            room: true,
            reservation: { select: { code: true, checkInDate: true } },
          },
        });
        if (conflict) {
          throw new ExtensionError(
            `Room ${conflict.room.number} is booked from ${formatDisplayDate(conflict.reservation.checkInDate)} (${conflict.reservation.code}).`,
            409
          );
        }

        const folio = reservation.folios[0];
        if (!folio) throw new ExtensionError("No open folio was found for this stay.");
        if (reservation.folios.length > 1) {
          throw new ExtensionError("This stay has more than one open folio. Ask a manager to review it.");
        }

        let additionalCharge = 0;
        for (const reservationRoom of reservation.rooms) {
          const unitPrice = Number(reservationRoom.rate);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new ExtensionError(
              `The agreed rate for room ${reservationRoom.room.number} is invalid.`
            );
          }

          const lineTotal = roundMoney(unitPrice * additionalNights);
          additionalCharge = roundMoney(additionalCharge + lineTotal);
          await tx.folioItem.create({
            data: {
              folioId: folio.id,
              type: "ROOM_CHARGE",
              description: `Room ${reservationRoom.room.number} — extension: ${additionalNights} night(s)`,
              quantity: additionalNights,
              unitPrice,
              taxRate: 0,
              total: lineTotal,
            },
          });
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { checkOutDate: newCheckOut },
        });

        const currentTotals = folioTotals(
          folio.items.map((item) => Number(item.total)),
          folio.payments.map((payment) => Number(payment.amount))
        );
        const required = roundMoney(currentTotals.required + additionalCharge);

        return {
          folioId: folio.id,
          additionalNights,
          additionalCharge,
          required,
          paid: currentTotals.paid,
          balance: roundMoney(required - currentTotals.paid),
          checkOutDate: newCheckOut.toISOString(),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      }
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ExtensionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The stay changed during the extension. Refresh and try again." },
        { status: 409 }
      );
    }
    console.error("Stay extension failed:", error);
    return NextResponse.json({ error: "Could not extend the stay." }, { status: 500 });
  }
}
