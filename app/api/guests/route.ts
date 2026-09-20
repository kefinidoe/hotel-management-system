import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const includeArchived = searchParams.get("includeArchived") === "true";

  const guests = await prisma.guest.findMany({
    where: {
      isArchived: includeArchived ? undefined : false,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reservations: {
        orderBy: { checkInDate: "desc" },
        take: 1,
        include: { rooms: { include: { room: true } } },
      },
    },
  });

  return NextResponse.json(
    guests.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      phone: g.phone,
      email: g.email,
      isArchived: g.isArchived,
      currentRoom: g.reservations[0]?.rooms[0]?.room.number ?? null,
      lastStatus: g.reservations[0]?.status ?? null,
      checkInDate: g.reservations[0]?.checkInDate.toISOString() ?? null,
      checkOutDate: g.reservations[0]?.checkOutDate.toISOString() ?? null,
    }))
  );
}