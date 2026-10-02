export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd) — used to prevent double-booking. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * The hotel's timezone. Every date shown to staff is a *business* date in
 * Nakuru, not whatever zone the process or the device happens to be in.
 *
 * Why this is pinned rather than left to the runtime: a restaurant charge or an
 * expense posted at 01:00 EAT is stored as 22:00 UTC the previous day, so a
 * bare `toLocaleDateString()` on a UTC machine (a server, or a device set to
 * UTC) files it under the wrong day. That is exactly the slip a night-shift
 * entry would produce.
 */
export const HOTEL_TIMEZONE = "Africa/Nairobi";

/**
 * Formats a date/time for display, pinned to the hotel's timezone.
 *
 * `locale` is deliberately left undefined by default so the rendered format is
 * whatever the browser already produced -- this fixes the *day*, not the look.
 * Pass a locale to get a stable format (used by the tests).
 */
export function formatDisplayDate(value: Date | string, locale?: string): string {
  return new Date(value).toLocaleDateString(locale, { timeZone: HOTEL_TIMEZONE });
}
