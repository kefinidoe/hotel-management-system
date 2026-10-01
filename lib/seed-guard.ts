/**
 * Safety rules for the destructive part of `prisma/seed.ts`.
 *
 * The seed contains one destructive step: a one-time cleanup of the placeholder
 * rooms (101/102) created by an earlier version of the seed. It used to run
 * unconditionally, so running the seed against a live database deleted the
 * reservations, folios, orders and payments attached to those rooms -- real
 * revenue, gone, with no warning and nothing to restore from.
 *
 * The rule now is based on what is actually attached to those rooms rather than
 * on the environment:
 *
 *   - nothing attached            -> clean up (this is the normal, intended case)
 *   - real activity attached      -> refuse, report it, and leave everything alone
 *   - overridden with SEED_ALLOW_DESTRUCTIVE_CLEANUP=true -> do it anyway, loudly
 *
 * These functions are pure so the rule can be tested without a database.
 */

export const DESTRUCTIVE_CLEANUP_ENV = "SEED_ALLOW_DESTRUCTIVE_CLEANUP";

export type CleanupImpact = {
  rooms: number;
  reservations: number;
  folios: number;
  payments: number;
  orders: number;
  folioItems: number;
  housekeepingTasks: number;
  maintenanceTickets: number;
  /** Total value of the payments that would be deleted. */
  paidTotal: number;
};

export type CleanupMode = "clean" | "overridden" | "blocked";

/**
 * Did a real person actually use these rooms?
 *
 * Any reservation, folio, order or payment counts. Housekeeping and maintenance
 * rows do not on their own -- they are created by the seed's own room setup and
 * carry no guest or money information.
 */
export function hasRealActivity(impact: CleanupImpact): boolean {
  return (
    impact.reservations > 0 ||
    impact.folios > 0 ||
    impact.payments > 0 ||
    impact.orders > 0 ||
    impact.folioItems > 0
  );
}

/** Whether the placeholder-room cleanup may run, and under which justification. */
export function cleanupMode(impact: CleanupImpact, allowDestructive: boolean): CleanupMode {
  if (allowDestructive) return "overridden";
  return hasRealActivity(impact) ? "blocked" : "clean";
}

/** Reads the override the way an operator would set it, tolerating "1"/"yes". */
export function isDestructiveCleanupAllowed(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test((value ?? "").trim());
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A plain-language summary of what a cleanup would delete. */
export function formatImpact(impact: CleanupImpact, roomNumbers: string[]): string[] {
  const lines = [
    `  ${plural(impact.rooms, "room")} on the placeholder tariffs: ${roomNumbers.join(", ")}`,
    "  Attached to them:",
    `    ${plural(impact.reservations, "reservation")}`,
    `    ${plural(impact.folios, "folio")}`,
    `    ${plural(impact.payments, "payment")}, totalling ${impact.paidTotal.toLocaleString("en-KE")}`,
    `    ${plural(impact.orders, "order")}, ${plural(impact.folioItems, "folio item")}`,
  ];

  if (impact.housekeepingTasks + impact.maintenanceTickets > 0) {
    lines.push(
      `    ${plural(impact.housekeepingTasks, "housekeeping task")}, ${plural(impact.maintenanceTickets, "maintenance ticket")}`
    );
  }

  return lines;
}
