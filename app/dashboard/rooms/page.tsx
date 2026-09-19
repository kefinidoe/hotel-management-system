import { prisma } from "@/lib/prisma";
import RoomsClient from "@/components/rooms/RoomsClient";

export const dynamic = 'force-dynamic';

export default async function RoomsPage() {
  const [rooms, roomTypes] = await Promise.all([
    prisma.room.findMany({ include: { roomType: true }, orderBy: { number: "asc" } }),
    prisma.roomType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const initialRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status,
    notes: r.notes,
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
  }));

  const initialRoomTypes = roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    description: rt.description,
    baseRate: Number(rt.baseRate),
    capacity: rt.capacity,
  }));

  return <RoomsClient initialRooms={initialRooms} initialRoomTypes={initialRoomTypes} />;
}
