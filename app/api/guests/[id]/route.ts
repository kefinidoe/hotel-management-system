import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const guest = await prisma.guest.findUnique({
    where: { id: params.id },
    include: {
      reservations: {
        orderBy: { checkInDate: "desc" },
        include: { rooms: { include: { room: true } } },
      },
      folios: {
        orderBy: { createdAt: "desc" },
        include: { items: true, payments: true },
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
    folios: guest.folios.map((f) => {
      const itemsTotal = f.items.reduce((s, i) => s + Number(i.total), 0);
      const paidTotal = f.payments.reduce((s, p) => s + Number(p.amount), 0);
      return {
        id: f.id,
        isClosed: f.isClosed,
        total: itemsTotal,
        paid: paidTotal,
        balance: itemsTotal - paidTotal,
      };
    }),
  });
}

// Archive or restore a guest. This NEVER deletes anything — it only flips a
// flag that hides the guest from the default list. Their reservations,
// folios, and payments are untouched either way, forever.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  if (typeof body.isArchived !== "boolean") {
    return NextResponse.json({ error: "isArchived (true or false) is required." }, { status: 400 });
  }

  // Guard: don't allow archiving a guest who is currently checked in.
  if (body.isArchived) {
    const activeStay = await prisma.reservation.findFirst({
      where: { guestId: params.id, status: "CHECKED_IN" },
    });
    if (activeStay) {
      return NextResponse.json(
        { error: "This guest is currently checked in and can't be archived." },
        { status: 400 }
      );
    }
  }

  const guest = await prisma.guest.update({
    where: { id: params.id },
    data: { isArchived: body.isArchived },
  });

  return NextResponse.json({ id: guest.id, isArchived: guest.isArchived });
}