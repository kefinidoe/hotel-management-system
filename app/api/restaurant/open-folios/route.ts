import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const folios = await prisma.folio.findMany({
    where: { isClosed: false, reservation: { status: "CHECKED_IN" } },
    include: {
      guest: true,
      reservation: { include: { rooms: { include: { room: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    folios.map((f) => {
      const rooms = f.reservation?.rooms.map((rr) => rr.room.number).join(", ") ?? "";
      return {
        id: f.id,
        label: rooms ? `Room ${rooms} · ${f.guest.fullName}` : f.guest.fullName,
      };
    })
  );
}