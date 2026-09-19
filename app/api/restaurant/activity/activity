import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const items = await prisma.folioItem.findMany({
    where: { type: "RESTAURANT" },
    include: {
      folio: {
        include: {
          guest: true,
          reservation: { include: { rooms: { include: { room: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const todaySales = await prisma.folioItem.aggregate({
    _sum: { total: true },
    where: { type: "RESTAURANT", createdAt: { gte: startOfToday() } },
  });

  return NextResponse.json({
    todayTotal: Number(todaySales._sum.total ?? 0),
    items: items.map((i) => {
      const rooms =
        i.folio.reservation?.rooms.map((rr) => rr.room.number).join(", ") ?? null;
      return {
        id: i.id,
        description: i.description,
        total: Number(i.total),
        guestName: i.folio.guest.fullName,
        roomNumber: rooms,
        settled: i.folio.isClosed,
        createdAt: i.createdAt.toISOString(),
      };
    }),
  });
}