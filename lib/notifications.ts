import { prisma } from "./prisma";
import { getCheckoutDeadline, isoDay } from "./dates";

export async function createNotification(title: string, body?: string, uniqueKey?: string) {
  try {
    // If a unique key is provided, we prevent duplicate notifications for the same event.
    if (uniqueKey) {
      const existing = await prisma.notification.findFirst({
        where: { body: { contains: `[KEY:${uniqueKey}]` } },
      });
      if (existing) return existing;
    }

    const bodyWithKey = uniqueKey ? `${body}\n\n[KEY:${uniqueKey}]` : body;

    return await prisma.notification.create({
      data: { title, body: bodyWithKey },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

/**
 * Checks for upcoming and overdue checkouts and generates notifications.
 * This is designed to be called regularly (e.g., when the Topbar polls).
 */
export async function processCheckoutReminders() {
  const now = new Date();
  const todayStr = isoDay(now);

  // Find all guests currently checked in.
  const reservations = await prisma.reservation.findMany({
    where: { status: "CHECKED_IN" },
    include: {
      guest: { select: { fullName: true } },
      rooms: { include: { room: { select: { number: true } } } },
    },
  });

  for (const res of reservations) {
    const checkoutDate = res.checkOutDate;
    const checkoutDayStr = isoDay(checkoutDate);
    const deadline = getCheckoutDeadline(checkoutDate);
    const roomNumbers = res.rooms.map((r) => r.room.number).join(", ");
    const guestInfo = `${res.guest.fullName} (Room ${roomNumbers})`;

    // 1. 24-Hour Reminder
    const twentyFourHoursBefore = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
    const twentyTwoHoursBefore = new Date(deadline.getTime() - 22 * 60 * 60 * 1000);
    if (now >= twentyFourHoursBefore && now < twentyTwoHoursBefore) {
      await createNotification(
        "Checkout Reminder: 24h",
        `Guest ${guestInfo} is scheduled to checkout tomorrow at ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        `24H:${res.id}:${checkoutDayStr}`
      );
    }

    // 2. Checkout Day Reminder (at start of day)
    if (checkoutDayStr === todayStr && now.getHours() >= 6 && now.getHours() < 8) {
      await createNotification(
        "Checkout Today",
        `Guest ${guestInfo} checkouts today at ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        `DAY:${res.id}:${checkoutDayStr}`
      );
    }

    // 3. Checkout Time Arrived
    if (now >= deadline && now.getTime() < deadline.getTime() + 15 * 60 * 1000) {
      await createNotification(
        "Checkout Time Arrived",
        `Guest ${guestInfo} is scheduled to checkout now.`,
        `TIME:${res.id}:${checkoutDayStr}`
      );
    }

    // 4. Overdue Alert (30 minutes after)
    const overdueDeadline = new Date(deadline.getTime() + 30 * 60 * 1000);
    if (now >= overdueDeadline) {
      await createNotification(
        "Checkout OVERDUE",
        `Guest ${guestInfo} is now 30+ minutes overdue for checkout. Scheduled: ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        `OVERDUE:${res.id}:${checkoutDayStr}`
      );
    }
  }
}
