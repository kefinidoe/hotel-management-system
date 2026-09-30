import type { ReservationStatus } from "@prisma/client";

const TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CANCELLED", "NO_SHOW"],
  CHECKED_IN: [],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function isReservationStatus(value: unknown): value is ReservationStatus {
  return typeof value === "string" && Object.hasOwn(TRANSITIONS, value);
}

export function canTransitionReservation(
  current: ReservationStatus,
  next: ReservationStatus
): boolean {
  return TRANSITIONS[current].includes(next);
}
