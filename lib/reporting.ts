import { HOTEL_TIMEZONE } from "./dates";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAIROBI_OFFSET = "+03:00";

/**
 * The hotel's timezone. Re-exported from lib/dates.ts so there is exactly one
 * definition -- a second copy is a second thing to typo.
 */
export const REPORT_TIME_ZONE = HOTEL_TIMEZONE;

export class ReportRangeError extends Error {}

function datePartsInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")!.value,
    month: parts.find((part) => part.type === "month")!.value,
    day: parts.find((part) => part.type === "day")!.value,
  };
}

export function reportDateKey(date: Date): string {
  const { year, month, day } = datePartsInTimeZone(date);
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, label: string): string {
  if (!DATE_PATTERN.test(value)) {
    throw new ReportRangeError(`${label} must be a valid date.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ReportRangeError(`${label} must be a valid date.`);
  }

  return value;
}

function nextDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

export function getReportRange(
  startParam: string | null,
  endParam: string | null,
  now = new Date()
) {
  const today = reportDateKey(now);
  const defaultStart = `${today.slice(0, 7)}-01`;
  const startDate = parseDateInput(startParam ?? defaultStart, "Start date");
  const endDate = parseDateInput(endParam ?? today, "End date");

  if (startDate > endDate) {
    throw new ReportRangeError("Start date cannot be after end date.");
  }

  const start = new Date(`${startDate}T00:00:00${NAIROBI_OFFSET}`);
  const endExclusive = new Date(`${nextDate(endDate)}T00:00:00${NAIROBI_OFFSET}`);

  return {
    startDate,
    endDate,
    start,
    endExclusive,
    endInclusive: new Date(endExclusive.getTime() - 1),
    timeZone: REPORT_TIME_ZONE,
  };
}
