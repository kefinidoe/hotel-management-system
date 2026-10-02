import { prisma } from "@/lib/prisma";
import ReservationsClient from "@/components/reservations/ReservationsClient";
import { requirePageRole } from "@/lib/page-auth";
import { ROLE_GROUPS } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const session = await requirePageRole(ROLE_GROUPS.GUEST_STAYS);

  const rooms = await prisma.room.findMany({
    // Retired rooms keep their history but cannot be booked.
    where: { isActive: true },
    include: { roomType: true },
    orderBy: { number: "asc" },
  });

  const initialRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    roomTypeName: r.roomType.name,
    baseRate: Number(r.roomType.baseRate),
    status: r.status,
  }));

  return <ReservationsClient rooms={initialRooms} currentUserRole={session.user.role} />;
}
