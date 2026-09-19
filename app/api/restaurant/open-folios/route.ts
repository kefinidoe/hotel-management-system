import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

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