import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { accommodationRequired, roundMoney, stayNights } from "@/lib/billing";
import { getStockStatus } from "@/lib/inventory";
import {
  getReportRange,
  reportDateKey,
  ReportRangeError,
} from "@/lib/reporting";

const RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
] as const;

function restaurantItemName(description: string) {
  const separator = " — ";
  const separatorIndex = description.indexOf(separator);
  return separatorIndex >= 0 ? description.slice(separatorIndex + separator.length) : description;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.FINANCIAL_REPORTS);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  let range: ReturnType<typeof getReportRange>;
  try {
    range = getReportRange(searchParams.get("start"), searchParams.get("end"));
  } catch (error) {
    if (error instanceof ReportRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "The report date range is invalid." }, { status: 400 });
  }

  const period = { gte: range.start, lt: range.endExclusive };

  const [folioItems, payments, expenses, reservations, restaurantItems, inventoryItems, allTariffs] =
    await Promise.all([
      prisma.folioItem.groupBy({
        by: ["type"],
        where: { createdAt: period },
        _sum: { total: true },
      }),
      prisma.payment.findMany({
        where: { createdAt: period, status: "COMPLETED" },
        select: {
          amount: true,
          paymentMethod: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: { createdAt: period, status: "APPROVED" },
        select: { category: true, amount: true },
      }),
      prisma.reservation.findMany({
        // Hotel stays use a half-open interval: check-in is included and
        // check-out is the first instant after the final occupied night.
        where: {
          checkInDate: { lt: range.endExclusive },
          checkOutDate: { gt: range.start },
        },
        orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          code: true,
          checkInDate: true,
          checkOutDate: true,
          status: true,
          source: true,
          adults: true,
          children: true,
          discount: true,
          createdAt: true,
          guest: {
            select: { id: true, fullName: true, phone: true, email: true },
          },
          rooms: {
            select: {
              rate: true,
              room: {
                select: {
                  number: true,
                  roomType: { select: { name: true } },
                },
              },
            },
          },
          folios: {
            select: {
              id: true,
              isClosed: true,
              items: { select: { type: true, total: true } },
              payments: {
                where: { status: "COMPLETED" },
                select: { amount: true },
              },
            },
          },
        },
      }),
      prisma.folioItem.findMany({
        where: { type: "RESTAURANT", createdAt: period },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
          createdAt: true,
          folio: {
            select: {
              isClosed: true,
              reservationId: true,
              guest: { select: { fullName: true } },
              reservation: {
                select: {
                  code: true,
                  rooms: { select: { room: { select: { number: true } } } },
                },
              },
            },
          },
        },
      }),
      prisma.inventoryItem.findMany({
        where: {
          OR: [
            { isActive: true },
            { stockMovements: { some: { createdAt: period } } },
          ],
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          unit: true,
          currentStock: true,
          reorderLevel: true,
          costPerUnit: true,
          isActive: true,
          stockMovements: {
            where: {
              createdAt: period,
              type: { in: ["MEAL_SALE", "WASTAGE", "ADJUSTMENT"] },
            },
            select: { type: true, quantity: true },
          },
        },
      }),
      prisma.roomType.findMany(),
    ]);

  // Financial activity recorded inside the selected date range.
  const billed = folioItems.map((item) => ({
    type: item.type,
    total: roundMoney(Number(item._sum.total ?? 0)),
  }));
  const billedTotal = roundMoney(billed.reduce((sum, item) => sum + item.total, 0));

  const collectedByMethod = new Map<string, number>();
  for (const payment of payments) {
    const method = payment.paymentMethod.name;
    collectedByMethod.set(
      method,
      (collectedByMethod.get(method) ?? 0) + Number(payment.amount)
    );
  }
  const collected = [...collectedByMethod.entries()]
    .map(([method, total]) => ({ method, total: roundMoney(total) }))
    .sort((a, b) => b.total - a.total);
  const collectedTotal = roundMoney(
    payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  );

  const expensesByCategory = new Map<string, number>();
  for (const expense of expenses) {
    expensesByCategory.set(
      expense.category,
      (expensesByCategory.get(expense.category) ?? 0) + Number(expense.amount)
    );
  }
  const expensesBreakdown = [...expensesByCategory.entries()]
    .map(([category, total]) => ({ category, total: roundMoney(total) }))
    .sort((a, b) => b.total - a.total);
  const expensesTotal = roundMoney(
    expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  );

  // Booking history is selected by stay overlap, but each row shows the
  // complete financial history of that booking, not just charges posted in
  // the selected date range.
  const bookingHistory = reservations.map((reservation) => {
    const chargeTotals = new Map<string, number>();
    let amountPaid = 0;

    for (const folio of reservation.folios) {
      for (const item of folio.items) {
        chargeTotals.set(
          item.type,
          (chargeTotals.get(item.type) ?? 0) + Number(item.total)
        );
      }
      amountPaid += folio.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );
    }

    const roomCharges = chargeTotals.get("ROOM_CHARGE") ?? 0;
    const discounts = chargeTotals.get("DISCOUNT") ?? 0;
    const accommodationSpent = roomCharges + discounts;
    const restaurantSpent = chargeTotals.get("RESTAURANT") ?? 0;
    const otherSpent =
      (chargeTotals.get("LAUNDRY") ?? 0) +
      (chargeTotals.get("OTHER_SERVICE") ?? 0) +
      (chargeTotals.get("TAX") ?? 0);
    const totalBilled = [...chargeTotals.values()].reduce(
      (sum, total) => sum + total,
      0
    );

    let bookedAccommodation = 0;
    try {
      bookedAccommodation = accommodationRequired(
        reservation.rooms.map((room) => Number(room.rate)),
        stayNights(reservation.checkInDate, reservation.checkOutDate),
        Number(reservation.discount ?? 0)
      );
    } catch {
      // Preserve the history row even if old data is incomplete.
      bookedAccommodation = 0;
    }

    return {
      id: reservation.id,
      code: reservation.code,
      guest: reservation.guest,
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      status: reservation.status,
      source: reservation.source,
      adults: reservation.adults,
      children: reservation.children,
      rooms: reservation.rooms.map((room) => {
        const matched = allTariffs.find((t) => Number(t.baseRate) === Number(room.rate));
        return {
          number: room.room.number,
          roomType: matched ? matched.name : room.room.roomType.name,
          nightlyRate: Number(room.rate),
        };
      }),
      bookedAccommodation: roundMoney(bookedAccommodation),
      accommodationSpent: roundMoney(accommodationSpent),
      restaurantSpent: roundMoney(restaurantSpent),
      otherSpent: roundMoney(otherSpent),
      totalBilled: roundMoney(totalBilled),
      amountPaid: roundMoney(amountPaid),
      balance: roundMoney(totalBilled - amountPaid),
      folioCount: reservation.folios.length,
      foliosClosed:
        reservation.folios.length > 0 &&
        reservation.folios.every((folio) => folio.isClosed),
    };
  });

  const bookingStatusCounts = Object.fromEntries(
    RESERVATION_STATUSES.map((status) => [
      status,
      bookingHistory.filter((booking) => booking.status === status).length,
    ])
  );
  const bookingSummary = {
    totalBookings: bookingHistory.length,
    statusCounts: bookingStatusCounts,
    bookedAccommodation: roundMoney(
      bookingHistory.reduce((sum, booking) => sum + booking.bookedAccommodation, 0)
    ),
    totalBilled: roundMoney(
      bookingHistory.reduce((sum, booking) => sum + booking.totalBilled, 0)
    ),
    amountPaid: roundMoney(
      bookingHistory.reduce((sum, booking) => sum + booking.amountPaid, 0)
    ),
    balanceDue: roundMoney(
      bookingHistory.reduce((sum, booking) => sum + Math.max(0, booking.balance), 0)
    ),
    creditBalance: roundMoney(
      bookingHistory.reduce((sum, booking) => sum + Math.max(0, -booking.balance), 0)
    ),
  };

  // A restaurant folio item is created only after a POS transaction succeeds.
  // This is the reliable sales record used by the current application for both
  // pay-now and charge-to-room sales.
  const restaurantSales = restaurantItems.map((item) => ({
    id: item.id,
    itemName: restaurantItemName(item.description),
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
    createdAt: item.createdAt.toISOString(),
    channel: item.folio.reservationId ? "ROOM_CHARGE" : "PAY_NOW",
    guestName: item.folio.guest.fullName,
    reservationCode: item.folio.reservation?.code ?? null,
    roomNumbers:
      item.folio.reservation?.rooms.map((room) => room.room.number) ?? [],
    folioClosed: item.folio.isClosed,
  }));

  const restaurantByDay = new Map<string, number>();
  const restaurantByItem = new Map<
    string,
    { itemName: string; quantity: number; revenue: number }
  >();
  let payNowRevenue = 0;
  let roomChargeRevenue = 0;

  for (const sale of restaurantSales) {
    const day = reportDateKey(new Date(sale.createdAt));
    restaurantByDay.set(day, (restaurantByDay.get(day) ?? 0) + sale.total);

    const current = restaurantByItem.get(sale.itemName) ?? {
      itemName: sale.itemName,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += sale.quantity;
    current.revenue += sale.total;
    restaurantByItem.set(sale.itemName, current);

    if (sale.channel === "PAY_NOW") payNowRevenue += sale.total;
    else roomChargeRevenue += sale.total;
  }

  const restaurantRevenue = roundMoney(
    restaurantSales.reduce((sum, sale) => sum + sale.total, 0)
  );
  const restaurant = {
    summary: {
      revenue: restaurantRevenue,
      itemsSold: restaurantSales.reduce((sum, sale) => sum + sale.quantity, 0),
      saleLines: restaurantSales.length,
      payNowRevenue: roundMoney(payNowRevenue),
      roomChargeRevenue: roundMoney(roomChargeRevenue),
    },
    revenueByDay: [...restaurantByDay.entries()]
      .map(([date, revenue]) => ({ date, revenue: roundMoney(revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topItems: [...restaurantByItem.values()]
      .map((item) => ({ ...item, revenue: roundMoney(item.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    sales: restaurantSales,
  };

  const stock = inventoryItems.map((item) => {
    let usedInSales = 0;
    let wastage = 0;
    let adjustmentAdded = 0;
    let adjustmentRemoved = 0;

    for (const movement of item.stockMovements) {
      const quantity = Number(movement.quantity);
      if (movement.type === "MEAL_SALE" && quantity < 0) {
        usedInSales += Math.abs(quantity);
      } else if (movement.type === "WASTAGE" && quantity < 0) {
        wastage += Math.abs(quantity);
      } else if (movement.type === "ADJUSTMENT" && quantity >= 0) {
        adjustmentAdded += quantity;
      } else if (movement.type === "ADJUSTMENT") {
        adjustmentRemoved += Math.abs(quantity);
      }
    }

    const currentStock = Number(item.currentStock);
    const reorderLevel = Number(item.reorderLevel);
    const costPerUnit = Number(item.costPerUnit);

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      isActive: item.isActive,
      currentStock,
      reorderLevel,
      status: getStockStatus(currentStock, reorderLevel),
      usedInSales: roundMoney(usedInSales),
      wastage: roundMoney(wastage),
      adjustmentAdded: roundMoney(adjustmentAdded),
      adjustmentRemoved: roundMoney(adjustmentRemoved),
      costPerUnit,
      currentValue: roundMoney(currentStock * costPerUnit),
      usageCost: roundMoney(usedInSales * costPerUnit),
      wastageCost: roundMoney(wastage * costPerUnit),
    };
  });

  const inventory = {
    summary: {
      activeItems: stock.filter((item) => item.isActive).length,
      lowStockItems: stock.filter(
        (item) => item.isActive && item.status !== "IN_STOCK"
      ).length,
      outOfStockItems: stock.filter(
        (item) => item.isActive && item.status === "OUT_OF_STOCK"
      ).length,
      currentStockValue: roundMoney(
        stock
          .filter((item) => item.isActive)
          .reduce((sum, item) => sum + item.currentValue, 0)
      ),
      usageCost: roundMoney(
        stock.reduce((sum, item) => sum + item.usageCost, 0)
      ),
      wastageCost: roundMoney(
        stock.reduce((sum, item) => sum + item.wastageCost, 0)
      ),
    },
    items: stock,
  };

  return NextResponse.json({
    range: {
      start: range.start.toISOString(),
      end: range.endInclusive.toISOString(),
      startDate: range.startDate,
      endDate: range.endDate,
      timeZone: range.timeZone,
      bookingBasis: "STAY_OVERLAP",
    },
    billed,
    billedTotal,
    collected,
    collectedTotal,
    expensesBreakdown,
    expensesTotal,
    netCashFlow: roundMoney(collectedTotal - expensesTotal),
    bookingSummary,
    bookingHistory,
    restaurant,
    inventory,
  });
}
