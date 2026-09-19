import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { items, paymentMethodId, roomNumber } = body as {
    items: { menuItemId: string; name: string; unitPrice: number; quantity: number }[];
    paymentMethodId?: string;
    roomNumber?: string;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Order has no items." }, { status: 400 });
  }

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  let folioId: string | null = null;

  if (roomNumber) {
    const room = await prisma.room.findUnique({ where: { number: roomNumber } });
    if (!room) return NextResponse.json({ error: "No room with that number." }, { status: 404 });

    const reservationRoom = await prisma.reservationRoom.findFirst({
      where: { roomId: room.id, reservation: { status: "CHECKED_IN" } },
      include: { reservation: { include: { folios: true } } },
      orderBy: { reservation: { checkInDate: "desc" } },
    });
    const openFolio = reservationRoom?.reservation.folios.find((f) => !f.isClosed);
    if (!openFolio) {
      return NextResponse.json(
        { error: "No checked-in guest with an open folio in that room." },
        { status: 400 }
      );
    }
    folioId = openFolio.id;
  } else if (!paymentMethodId) {
    return NextResponse.json({ error: "Choose a payment method or charge to a room." }, { status: 400 });
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        status: "PAID",
        paymentMethodId: folioId ? null : paymentMethodId,
        folioId,
        total,
        items: {
          create: items.map((i) => ({
            menuItemId: i.menuItemId || null,
            name: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            total: i.unitPrice * i.quantity,
          })),
        },
      },
    });

    if (folioId) {
      await tx.folioItem.create({
        data: {
          folioId,
          type: "RESTAURANT",
          description: `Restaurant order (Room ${roomNumber})`,
          quantity: 1,
          unitPrice: total,
          taxRate: 0,
          total,
        },
      });
    }

    return created;
  });

  return NextResponse.json({ id: order.id, total, chargedToRoom: Boolean(folioId) }, { status: 201 });
}
