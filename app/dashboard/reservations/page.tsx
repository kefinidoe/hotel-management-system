import { prisma } from "@/lib/prisma";
import ReservationsClient from "@/components/reservations/ReservationsClient";

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const rooms = await prisma.room.findMany({
    include: { roomType: true },
    orderBy: { number: "asc" },
  });

  const initialRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    roomTypeName: r.roomType.name,
    baseRate: Number(r.roomType.baseRate),
    isTwin: r.isTwin,
  }));

  return <ReservationsClient rooms={initialRooms} />;
}
