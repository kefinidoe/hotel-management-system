import type { RoomStatus } from "@prisma/client";

/**
 * The single source of truth for how a room's status is shown to staff.
 *
 * The receptionist reads this to decide which room to hand a guest, so every
 * status is always shown as a word, never as a colour on its own. Colours are a
 * second cue on top of the words.
 */

/** Plain-English name for each status. */
export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  AVAILABLE: "Available",
  READY: "Ready",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
  CLEANING: "Being Cleaned",
  DIRTY: "Needs Cleaning",
  MAINTENANCE: "Maintenance",
  OUT_OF_ORDER: "Out of Order",
};

/** One-line explanation, for tooltips and empty-state help. */
export const ROOM_STATUS_HINTS: Record<RoomStatus, string> = {
  AVAILABLE: "Free and ready for a guest.",
  READY: "Cleaned and inspected — free for a guest.",
  RESERVED: "Held for a guest arriving later.",
  OCCUPIED: "A guest is staying in this room.",
  CLEANING: "Housekeeping is working on it.",
  DIRTY: "Not cleaned yet — do not give this to a guest.",
  MAINTENANCE: "Being repaired — out of service.",
  OUT_OF_ORDER: "Out of service.",
};

export const ROOM_STATUSES = Object.keys(ROOM_STATUS_LABELS) as RoomStatus[];

/**
 * Can this room be given to a guest right now?
 *
 * Only a room that is free and clean counts. A dirty room is deliberately
 * excluded: putting a guest in an uncleaned room is the exact mistake this
 * screen exists to prevent.
 */
export function isBookableToday(status: RoomStatus): boolean {
  return status === "AVAILABLE" || status === "READY";
}

/**
 * Statuses that make a room unfit to put a guest in *at all* -- dirty, being
 * cleaned, occupied by someone else, or out of service.
 *
 * RESERVED is deliberately not on this list: a room is often marked reserved
 * for the very booking being checked in, so treating it as blocked would stop
 * the receptionist doing their job.
 */
export function blocksGuestPlacement(status: RoomStatus): boolean {
  return (
    status === "DIRTY" ||
    status === "CLEANING" ||
    status === "OCCUPIED" ||
    status === "MAINTENANCE" ||
    status === "OUT_OF_ORDER"
  );
}

/** Why a room cannot be used, phrased for the receptionist. */
export function notBookableReason(status: RoomStatus): string {
  switch (status) {
    case "OCCUPIED":
      return "A guest is in this room.";
    case "RESERVED":
      return "Reserved for another guest.";
    case "DIRTY":
      return "Needs cleaning first.";
    case "CLEANING":
      return "Housekeeping is cleaning it.";
    case "MAINTENANCE":
      return "Under maintenance.";
    case "OUT_OF_ORDER":
      return "Out of order.";
    default:
      return "";
  }
}

/** Colour treatment, matching the Rooms page so staff see one consistent system. */
export function roomStatusClasses(status: RoomStatus): string {
  switch (status) {
    case "AVAILABLE":
    case "READY":
      return "bg-primary-50 text-primary-700 border-primary-100";
    case "OCCUPIED":
      return "bg-champagne-50 text-champagne-500 border-champagne-100";
    case "RESERVED":
    case "CLEANING":
      return "bg-info/10 text-info border-info/20";
    case "DIRTY":
      return "bg-warning/10 text-warning border-warning/20";
    case "MAINTENANCE":
    case "OUT_OF_ORDER":
      return "bg-danger/10 text-danger border-danger/20";
    default:
      return "bg-bg text-text-secondary border-border";
  }
}

/** Small solid dot, for compact views such as the reservation room picker. */
export function roomStatusDotClasses(status: RoomStatus): string {
  switch (status) {
    case "AVAILABLE":
    case "READY":
      return "bg-primary-500";
    case "OCCUPIED":
      return "bg-champagne-500";
    case "RESERVED":
    case "CLEANING":
      return "bg-info";
    case "DIRTY":
      return "bg-warning";
    case "MAINTENANCE":
    case "OUT_OF_ORDER":
      return "bg-danger";
    default:
      return "bg-text-muted";
  }
}

/**
 * Ordering for lists: rooms a guest could be put in come first, then the ones
 * that need attention soonest, with the unusable rooms last.
 */
const SORT_ORDER: Record<RoomStatus, number> = {
  AVAILABLE: 0,
  READY: 1,
  RESERVED: 2,
  CLEANING: 3,
  DIRTY: 4,
  OCCUPIED: 5,
  MAINTENANCE: 6,
  OUT_OF_ORDER: 7,
};

export function roomStatusRank(status: RoomStatus): number {
  return SORT_ORDER[status] ?? 99;
}

/** Counts per status, for the summary line above the board. */
export function summariseRooms<T extends { status: RoomStatus }>(rooms: T[]) {
  const counts = new Map<RoomStatus, number>();
  for (const room of rooms) {
    counts.set(room.status, (counts.get(room.status) ?? 0) + 1);
  }
  return {
    total: rooms.length,
    bookable: rooms.filter((room) => isBookableToday(room.status)).length,
    counts,
  };
}
