import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import FrontDeskClient from "@/components/frontdesk/FrontDeskClient";
import { requirePageRole } from "@/lib/page-auth";
import { ROLE_GROUPS } from "@/lib/permissions";
import {
  accommodationRequired,
  folioTotals,
  roundMoney,
  stayNights,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const frontDeskInclude = {
  guest: true,
  rooms: { include: { room: true } },
  folios: {
    include: {
      items: { select: { total: true } },
      payments: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
    },
  },
} satisfies Prisma.ReservationInclude;

type FrontDeskReservation = Prisma.ReservationGetPayload<{
  include: typeof frontDeskInclude;
}>;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function serializeReservation(reservation: FrontDeskReservation) {
  const openFolio = reservation.folios.find((folio) => !folio.isClosed);
  const totals = openFolio
    ? folioTotals(
        openFolio.items.map((item) => Number(item.total)),
        openFolio.payments.map((payment) => Number(payment.amount))
      )
    : (() => {
        const required = accommodationRequired(
          reservation.rooms.map((room) => Number(room.rate)),
          stayNights(reservation.checkInDate, reservation.checkOutDate),
          Number(reservation.discount ?? 0)
        );
        return { required, paid: 0, balance: required };
      })();

  return {
    id: reservation.id,
    code: reservation.code,
    guestName: reservation.guest.fullName,
    checkInDate: reservation.checkInDate.toISOString(),
    checkOutDate: reservation.checkOutDate.toISOString(),
    roomNumbers: reservation.rooms.map((room) => room.room.number).join(", "),
    openFolioId: openFolio?.id ?? null,
    requiredAmount: totals.required,
    paidAmount: totals.paid,
    balance: totals.balance,
    nightlyRateTotal: roundMoney(
      reservation.rooms.reduce((sum, room) => sum + Number(room.rate), 0)
    ),
  };
}

export default async function FrontDeskPage() {
  const session = await requirePageRole(ROLE_GROUPS.FRONT_DESK);
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [reservations, rooms] = await Promise.all([
    prisma.reservation.findMany({
      relationLoadStrategy: "join",
      where: {
        OR: [
          {
            checkInDate: { gte: todayStart, lt: todayEnd },
            status: { in: ["CONFIRMED", "PENDING"] },
          },
          { status: "CHECKED_IN" },
        ],
      },
      include: frontDeskInclude,
      orderBy: { checkInDate: "asc" },
    }),
    prisma.room.findMany({
      relationLoadStrategy: "join",
      include: { roomType: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const arrivals = reservations.filter(
    (reservation) =>
      (reservation.status === "CONFIRMED" || reservation.status === "PENDING") &&
      reservation.checkInDate >= todayStart &&
      reservation.checkInDate < todayEnd
  );
  const inHouse = reservations.filter(
    (reservation) => reservation.status === "CHECKED_IN"
  );
  const departures = inHouse
    .filter(
      (reservation) =>
        reservation.checkOutDate >= todayStart &&
        reservation.checkOutDate < todayEnd
    )
    .sort(
      (left, right) =>
        left.checkOutDate.getTime() - right.checkOutDate.getTime()
    );

  return (
    <FrontDeskClient
      currentUserRole={session.user.role}
      arrivals={arrivals.map(serializeReservation)}
      departures={departures.map(serializeReservation)}
      inHouse={inHouse.map(serializeReservation)}
      availableRoomsCount={rooms.filter((room) => room.status === "AVAILABLE").length}
      rooms={rooms.map((room) => ({
        id: room.id,
        number: room.number,
        roomTypeName: room.roomType.name,
        baseRate: Number(room.roomType.baseRate),
        isTwin: room.isTwin,
      }))}
    />
  );
}
