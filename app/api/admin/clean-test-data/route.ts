import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/authz";

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const forbidden = requireRole(session, ["ADMIN"]);
  if (forbidden) return forbidden;

  const deletedPayments = await prisma.payment.deleteMany({});
  const deletedFolioItems = await prisma.folioItem.deleteMany({});
  const deletedOrderItems = await prisma.orderItem.deleteMany({});
  const deletedOrders = await prisma.order.deleteMany({});
  const deletedFolios = await prisma.folio.deleteMany({});
  const deletedReservationRooms = await prisma.reservationRoom.deleteMany({});
  const deletedReservations = await prisma.reservation.deleteMany({});
  const deletedHousekeeping = await prisma.housekeepingTask.deleteMany({});
  const deletedMaintenance = await prisma.maintenanceTicket.deleteMany({});
  const deletedStockMovements = await prisma.stockMovement.deleteMany({});
  const deletedPurchases = await prisma.purchase.deleteMany({});
  const deletedWastage = await prisma.wastage.deleteMany({});
  const deletedExpenses = await prisma.expense.deleteMany({});
  const deletedNotifications = await prisma.notification.deleteMany({});
  const deletedAuditLogs = await prisma.auditLog.deleteMany({});
  const deletedGuests = await prisma.guest.deleteMany({});
  const updatedRooms = await prisma.room.updateMany({
    data: {
      status: "AVAILABLE",
      notes: null,
    },
  });

  return NextResponse.json({
    ok: true,
    summary: {
      payments: deletedPayments.count,
      folioItems: deletedFolioItems.count,
      orderItems: deletedOrderItems.count,
      orders: deletedOrders.count,
      folios: deletedFolios.count,
      reservationRooms: deletedReservationRooms.count,
      reservations: deletedReservations.count,
      housekeepingTasks: deletedHousekeeping.count,
      maintenanceTickets: deletedMaintenance.count,
      stockMovements: deletedStockMovements.count,
      purchases: deletedPurchases.count,
      wastage: deletedWastage.count,
      expenses: deletedExpenses.count,
      notifications: deletedNotifications.count,
      auditLogs: deletedAuditLogs.count,
      guests: deletedGuests.count,
      roomsReset: updatedRooms.count,
    },
  });
}
