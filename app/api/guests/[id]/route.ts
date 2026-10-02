import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { folioTotals } from "@/lib/billing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      reservations: {
        orderBy: { checkInDate: "desc" },
        include: { rooms: { include: { room: true } } },
      },
      folios: {
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          payments: { where: { status: "COMPLETED" } },
        },
      },
    },
  });

  if (!guest) return NextResponse.json({ error: "Guest not found." }, { status: 404 });

  return NextResponse.json({
    id: guest.id,
    fullName: guest.fullName,
    phone: guest.phone,
    email: guest.email,
    idNumber: guest.idNumber,
    nationality: guest.nationality,
    vehicleRegistration: guest.vehicleRegistration,
    notes: guest.notes,
    isArchived: guest.isArchived,
    reservations: guest.reservations.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      checkInDate: r.checkInDate.toISOString(),
      checkOutDate: r.checkOutDate.toISOString(),
      rooms: r.rooms.map((rr) => ({ roomNumber: rr.room.number, rate: Number(rr.rate) })),
    })),
    folios: guest.folios.map((folio) => {
      const totals = folioTotals(
        folio.items.map((item) => Number(item.total)),
        folio.payments.map((payment) => Number(payment.amount))
      );
      return {
        id: folio.id,
        isClosed: folio.isClosed,
        total: totals.required,
        paid: totals.paid,
        balance: totals.balance,
      };
    }),
  });
}

// Archive or restore a guest. This NEVER deletes anything — it only flips a
// flag that hides the guest from the default list. Their reservations,
// folios, and payments are untouched either way, forever.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.GUEST_STAYS);
  if (forbidden) return forbidden;

  const body = await req.json();
  if (typeof body.isArchived !== "boolean") {
    return NextResponse.json({ error: "isArchived (true or false) is required." }, { status: 400 });
  }

  // Guard: don't allow archiving a guest who is currently checked in.
  if (body.isArchived) {
    const activeStay = await prisma.reservation.findFirst({
      where: { guestId: id, status: "CHECKED_IN" },
    });
    if (activeStay) {
      return NextResponse.json(
        { error: "This guest is currently checked in and can't be archived." },
        { status: 400 }
      );
    }
  }

  const guest = await prisma.guest.update({
    where: { id },
    data: { isArchived: body.isArchived },
  });

  return NextResponse.json({ id: guest.id, isArchived: guest.isArchived });
}