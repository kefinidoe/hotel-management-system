import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting Axis Hotel Test Data Cleanup...\n");

  // 1. Transactional Billing & Reservations
  const deletedPayments = await prisma.payment.deleteMany({});
  console.log(`✓ Deleted ${deletedPayments.count} test payments`);

  const deletedFolioItems = await prisma.folioItem.deleteMany({});
  console.log(`✓ Deleted ${deletedFolioItems.count} test folio items`);

  const deletedOrderItems = await prisma.orderItem.deleteMany({});
  console.log(`✓ Deleted ${deletedOrderItems.count} test restaurant order items`);

  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`✓ Deleted ${deletedOrders.count} test restaurant orders`);

  const deletedFolios = await prisma.folio.deleteMany({});
  console.log(`✓ Deleted ${deletedFolios.count} test guest folios`);

  const deletedReservationRooms = await prisma.reservationRoom.deleteMany({});
  console.log(`✓ Deleted ${deletedReservationRooms.count} test reservation room links`);

  const deletedReservations = await prisma.reservation.deleteMany({});
  console.log(`✓ Deleted ${deletedReservations.count} test reservations`);

  // 2. Housekeeping & Maintenance
  const deletedHousekeeping = await prisma.housekeepingTask.deleteMany({});
  console.log(`✓ Deleted ${deletedHousekeeping.count} test housekeeping tasks`);

  const deletedMaintenance = await prisma.maintenanceTicket.deleteMany({});
  console.log(`✓ Deleted ${deletedMaintenance.count} test maintenance tickets`);

  // 3. Expenses, Notifications, and Audit Logs
  const deletedExpenses = await prisma.expense.deleteMany({});
  console.log(`✓ Deleted ${deletedExpenses.count} test expenses`);

  const deletedNotifications = await prisma.notification.deleteMany({});
  console.log(`✓ Deleted ${deletedNotifications.count} old notifications`);

  const deletedAuditLogs = await prisma.auditLog.deleteMany({});
  console.log(`✓ Deleted ${deletedAuditLogs.count} test audit logs`);

  // 4. Test Guests
  const deletedGuests = await prisma.guest.deleteMany({});
  console.log(`✓ Deleted ${deletedGuests.count} test guest profiles`);

  // 5. Reset all Room statuses to AVAILABLE
  const updatedRooms = await prisma.room.updateMany({
    data: {
      status: "AVAILABLE",
      notes: null,
    },
  });
  console.log(`✓ Reset ${updatedRooms.count} rooms to AVAILABLE & clean`);

  console.log("\n🎉 The database is completely clean and ready for client hotel deployment!");
  console.log("   • All staff accounts preserved");
  console.log("   • All rooms and tariff configurations preserved");
  console.log("   • All restaurant menu items and inventory preserved");
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
