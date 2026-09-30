import { prisma } from "@/lib/prisma";
import FrontDeskClient from "@/components/frontdesk/FrontDeskClient";

export const dynamic = 'force-dynamic';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

export default async function FrontDeskPage() {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [arrivals, departures, inHouse, rooms] = await Promise.all([
    prisma.reservation.findMany({
      where: { checkInDate: { gte: todayStart, lt: todayEnd }, status: { in: ["CONFIRMED", "PENDING"] } },
      include: { guest: true, rooms: { include: { room: true } } },
      orderBy: { checkInDate: "asc" },
    }),
    prisma.reservation.findMany({
      where: { checkOutDate: { gte: todayStart, lt: todayEnd }, status: "CHECKED_IN" },
      include: { guest: true, rooms: { include: { room: true } }, folios: true },
      orderBy: { checkOutDate: "asc" },
    }),
    prisma.reservation.findMany({
      where: { status: "CHECKED_IN" },
      include: { guest: true, rooms: { include: { room: true } }, folios: true },
      orderBy: { checkInDate: "asc" },
    }),
    prisma.room.findMany({ include: { roomType: true }, orderBy: { number: "asc" } }),
  ]);

  const serializeRes = (r: (typeof arrivals)[number] & { folios?: { id: string; isClosed: boolean }[] }) => ({
    id: r.id,
    code: r.code,
    guestName: r.guest.fullName,
    checkInDate: r.checkInDate.toISOString(),
    checkOutDate: r.checkOutDate.toISOString(),
    roomNumbers: r.rooms.map((rr) => rr.room.number).join(", "),
    openFolioId: r.folios?.find((f) => !f.isClosed)?.id ?? null,
  });

  return (
    <FrontDeskClient
      arrivals={arrivals.map(serializeRes)}
      departures={departures.map(serializeRes)}
      inHouse={inHouse.map(serializeRes)}
      availableRoomsCount={rooms.filter((r) => r.status === "AVAILABLE").length}
      rooms={rooms.map((r) => ({
        id: r.id,
        number: r.number,
        roomTypeName: r.roomType.name,
        baseRate: Number(r.roomType.baseRate),
        isTwin: r.isTwin,
      }))}
    />
  );
}
