import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
