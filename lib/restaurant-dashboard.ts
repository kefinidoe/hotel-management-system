import "server-only";
import { prisma } from "@/lib/prisma";

export type RestaurantOpenFolio = { id: string; label: string };
export type RestaurantPaymentMethod = { id: string; name: string };
export type RestaurantActivityItem = {
  id: string;
  description: string;
  total: number;
  guestName: string;
  roomNumber: string | null;
  settled: boolean;
  createdAt: string;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getRestaurantOpenFolios(): Promise<RestaurantOpenFolio[]> {
  const folios = await prisma.folio.findMany({
    relationLoadStrategy: "join",
    where: { isClosed: false, reservation: { status: "CHECKED_IN" } },
    select: {
      id: true,
      guest: { select: { fullName: true } },
      reservation: {
        select: {
          rooms: { select: { room: { select: { number: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return folios.map((folio) => {
    const rooms =
      folio.reservation?.rooms
        .map((reservationRoom) => reservationRoom.room.number)
        .join(", ") ?? "";
    return {
      id: folio.id,
      label: rooms
        ? `Room ${rooms} · ${folio.guest.fullName}`
        : folio.guest.fullName,
    };
  });
}

export async function getRestaurantPaymentMethods(): Promise<
  RestaurantPaymentMethod[]
> {
  return prisma.paymentMethod.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getRestaurantActivity(): Promise<{
  items: RestaurantActivityItem[];
  todayTotal: number;
}> {
  const [items, todaySales] = await Promise.all([
    prisma.folioItem.findMany({
      relationLoadStrategy: "join",
      where: { type: "RESTAURANT" },
      select: {
        id: true,
        description: true,
        total: true,
        createdAt: true,
        folio: {
          select: {
            isClosed: true,
            guest: { select: { fullName: true } },
            reservation: {
              select: {
                rooms: { select: { room: { select: { number: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.folioItem.aggregate({
      _sum: { total: true },
      where: {
        type: "RESTAURANT",
        createdAt: { gte: startOfToday() },
      },
    }),
  ]);

  return {
    todayTotal: Number(todaySales._sum.total ?? 0),
    items: items.map((item) => {
      const rooms =
        item.folio.reservation?.rooms
          .map((reservationRoom) => reservationRoom.room.number)
          .join(", ") ?? null;
      return {
        id: item.id,
        description: item.description,
        total: Number(item.total),
        guestName: item.folio.guest.fullName,
        roomNumber: rooms,
        settled: item.folio.isClosed,
        createdAt: item.createdAt.toISOString(),
      };
    }),
  };
}

export async function getRestaurantDashboardData() {
  const [folios, paymentMethods, activity] = await Promise.all([
    getRestaurantOpenFolios(),
    getRestaurantPaymentMethods(),
    getRestaurantActivity(),
  ]);

  return {
    folios,
    paymentMethods,
    activity: activity.items,
    todayTotal: activity.todayTotal,
  };
}
