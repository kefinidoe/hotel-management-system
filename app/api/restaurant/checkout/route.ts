import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { items, mode, roomNumber, paymentMethodId } = body as {
    items: { name: string; price: number; quantity: number }[];
    mode: "ROOM" | "DIRECT";
    roomNumber?: string;
    paymentMethodId?: string;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "The order is empty." }, { status: 400 });
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const description = items.map((i) => `${i.quantity}x ${i.name}`).join(", ");

  if (mode === "ROOM") {
    if (!roomNumber) {
      return NextResponse.json({ error: "Room number is required to charge to a room." }, { status: 400 });
    }
    const room = await prisma.room.findUnique({ where: { number: roomNumber } });
    if (!room) return NextResponse.json({ error: `No room numbered ${roomNumber}.` }, { status: 404 });

    const activeStay = await prisma.reservationRoom.findFirst({
      where: { roomId: room.id, reservation: { status: "CHECKED_IN" } },
      include: { reservation: { include: { folios: true } } },
    });
    if (!activeStay) {
      return NextResponse.json({ error: `No guest is currently checked into room ${roomNumber}.` }, { status: 400 });
    }
    const openFolio = activeStay.reservation.folios.find((f) => !f.isClosed);
    if (!openFolio) {
      return NextResponse.json({ error: "That guest has no open folio to charge." }, { status: 400 });
    }

    await prisma.folioItem.create({
      data: {
        folioId: openFolio.id,
        type: "RESTAURANT",
        description,
        quantity: 1,
        unitPrice: total,
        taxRate: 0,
        total,
      },
    });

    return NextResponse.json({ ok: true, chargedToRoom: roomNumber, total });
  }

  // DIRECT sale: paid immediately at the till.
  if (!paymentMethodId) {
    return NextResponse.json({ error: "A payment method is required." }, { status: 400 });
  }

  let walkIn = await prisma.guest.findFirst({ where: { fullName: "Walk-in Customer", phone: null } });
  if (!walkIn) {
    walkIn = await prisma.guest.create({ data: { fullName: "Walk-in Customer" } });
  }

  const folio = await prisma.folio.create({ data: { guestId: walkIn.id, isClosed: true } });
  await prisma.folioItem.create({
    data: { folioId: folio.id, type: "RESTAURANT", description, quantity: 1, unitPrice: total, taxRate: 0, total },
  });
  await prisma.payment.create({
    data: { folioId: folio.id, paymentMethodId, amount: total, status: "COMPLETED", cashierId: session.user.id },
  });

  return NextResponse.json({ ok: true, total });
}
