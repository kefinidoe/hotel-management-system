import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

const RESULT_LIMIT = 5;

export async function GET(req: Request) {
    const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.FRONT_DESK);
  if (forbidden) return forbidden;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  // Require at least 2 characters — avoids scanning the whole guest table
  // on every keystroke of a 1-letter query, which is wasted DB load for
  // results no one can usefully read anyway.
  if (q.length < 2) {
    return NextResponse.json({ guests: [], reservations: [], rooms: [] });
  }

  const [guests, reservations, rooms] = await Promise.all([
    prisma.guest.findMany({
      where: {
        isArchived: false,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, fullName: true, phone: true, email: true },
      take: RESULT_LIMIT,
      orderBy: { fullName: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { guest: { fullName: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        code: true,
        status: true,
        checkInDate: true,
        guest: { select: { fullName: true } },
      },
      take: RESULT_LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.room.findMany({
      where: {
        isActive: true,
        number: { contains: q, mode: "insensitive" },
      },
      select: { id: true, number: true, status: true },
      take: RESULT_LIMIT,
      orderBy: { number: "asc" },
    }),
  ]);

  return NextResponse.json({ guests, reservations, rooms });
}