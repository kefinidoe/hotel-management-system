import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { folioTotals } from "@/lib/billing";
import { hasRole } from "@/lib/permissions";

class CheckOutError extends Error {
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
  const allowOutstandingBalance = body.allowOutstandingBalance === true;

  if (!reservationId) {
    return NextResponse.json({ error: "Reservation is required." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
          include: {
            rooms: true,
            folios: {
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
        if (!reservation) throw new CheckOutError("Reservation not found.", 404);
        if (reservation.status !== "CHECKED_IN") {
          throw new CheckOutError("Only a checked-in reservation can be checked out.");
        }

        const openFolio = reservation.folios.find((folio) => !folio.isClosed);
        if (!openFolio) {
          throw new CheckOutError("No open folio was found for this reservation.");
        }

        const totals = folioTotals(
          openFolio.items.map((item) => Number(item.total)),
          openFolio.payments.map((payment) => Number(payment.amount))
        );

        if (totals.balance > 0) {
          if (!allowOutstandingBalance) {
            throw new CheckOutError(
              `KSh ${totals.balance.toLocaleString()} is still due before checkout.`,
              409
            );
          }
          if (!hasRole(session.user.role, ROLE_GROUPS.MANAGEMENT)) {
            throw new CheckOutError(
              "Only an Admin or Manager can check out a guest with an unpaid balance.",
              403
            );
          }
        }

        await tx.folio.update({
          where: { id: openFolio.id },
          data: { isClosed: true },
        });
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "CHECKED_OUT" },
        });

        for (const reservationRoom of reservation.rooms) {
          await tx.room.update({
            where: { id: reservationRoom.roomId },
            data: { status: "DIRTY" },
          });
          await tx.housekeepingTask.create({
            data: {
              roomId: reservationRoom.roomId,
              status: "NEEDS_CLEANING",
              priority: "normal",
            },
          });
        }

        return { folioId: openFolio.id, ...totals };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      }
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CheckOutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The folio changed during checkout. Refresh and try again." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not complete checkout." }, { status: 500 });
  }
}
