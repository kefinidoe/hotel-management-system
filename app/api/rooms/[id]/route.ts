import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

const ACTIVE_RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

class RoomRemovalError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const room = await prisma.room.update({
    where: { id },
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  try {
    const room = await prisma.$transaction(
      async (tx) => {
        // Reservation creation uses the same lock. A room therefore cannot be
        // removed while a new reservation is being assigned to it.
        await tx.$queryRaw<Array<{ locked: string }>>`
          SELECT pg_advisory_xact_lock(hashtext('axis-hotel-reservation-create'))::text AS locked
        `;

        const existing = await tx.room.findUnique({
          where: { id },
          select: {
            id: true,
            number: true,
            isActive: true,
            reservationRooms: {
              where: {
                reservation: { status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
              },
              select: {
                reservation: { select: { code: true, status: true } },
              },
              take: 1,
            },
          },
        });

        if (!existing) throw new RoomRemovalError("Room not found.", 404);
        if (!existing.isActive) return existing;

        const blockingReservation = existing.reservationRooms[0]?.reservation;
        if (blockingReservation) {
          throw new RoomRemovalError(
            `Room ${existing.number} cannot be removed while reservation ${blockingReservation.code} is ${blockingReservation.status.toLowerCase().replace("_", " ")}.`,
            409
          );
        }

        return tx.room.update({
          where: { id },
          data: { isActive: false, status: "OUT_OF_ORDER" },
          select: { id: true, number: true, isActive: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      }
    );

    return NextResponse.json({ ok: true, room });
  } catch (error) {
    if (error instanceof RoomRemovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The room changed at the same time. Refresh and try again." },
        { status: 409 }
      );
    }
    console.error("Room removal failed:", error);
    return NextResponse.json({ error: "Could not remove the room." }, { status: 500 });
  }
}
