import { describe, it, expect } from "vitest";
import {
  formatDisplayDate,
  HOTEL_TIMEZONE,
  startOfWeek,
  addDays,
  rangesOverlap,
} from "../../lib/dates";

/**
 * The bug these guard against: a guest charge or an expense posted at 01:00
 * EAT is stored as 22:00 UTC the *previous* day. Formatting that with a bare
 * `toLocaleDateString()` on any machine not set to Nairobi time files it under
 * the wrong business day -- exactly the slip a night-shift entry produces.
 *
 * Every expected value below is written in EAT, so these pass regardless of the
 * timezone the test process happens to run in.
 */

describe("formatDisplayDate", () => {
  it("uses the hotel's timezone, not the runtime's", () => {
    expect(HOTEL_TIMEZONE).toBe("Africa/Nairobi");

    // 21:00 UTC == 00:00 EAT the next day. This is the boundary the bug hits.
    const justAfterMidnightInNakuru = "2026-10-02T21:00:00Z";
    expect(formatDisplayDate(justAfterMidnightInNakuru, "en-GB")).toBe("03/10/2026");

    // One second earlier is still the 2nd, in both zones. Pins down that the
    // assertion above is about the timezone and not about rounding.
    expect(formatDisplayDate("2026-10-02T20:59:59Z", "en-GB")).toBe("02/10/2026");
  });

  it("would have been a day early without the timezone pin", () => {
    // Same instant, rendered the way the old bare call did on a UTC machine.
    const instant = new Date("2026-10-02T21:00:00Z");
    const renderedUtc = instant.toLocaleDateString("en-GB", { timeZone: "UTC" });
    const renderedHotel = formatDisplayDate(instant, "en-GB");

    expect(renderedUtc).toBe("02/10/2026");
    expect(renderedHotel).toBe("03/10/2026");
    // If these ever match, the pin has been removed.
    expect(renderedHotel).not.toBe(renderedUtc);
  });

  it("leaves check-in dates alone when they are stored at UTC midnight", () => {
    // reservations are saved as `new Date("YYYY-MM-DD").toISOString()`, i.e.
    // UTC midnight, which is 03:00 the same day in Nairobi. Pinning the zone
    // must not shift these to the previous day.
    expect(formatDisplayDate("2026-10-03T00:00:00.000Z", "en-GB")).toBe("03/10/2026");
  });

  it("accepts both Date objects and ISO strings", () => {
    const asDate = new Date("2026-03-15T09:30:00Z");
    expect(formatDisplayDate(asDate, "en-GB")).toBe(formatDisplayDate(asDate.toISOString(), "en-GB"));
    expect(formatDisplayDate(asDate, "en-GB")).toBe("15/03/2026");
  });

  it("does not force a display format when no locale is given", () => {
    // No locale -> whatever the environment already produced. The fix is the
    // day, not the look, so the default call must stay locale-driven.
    const bare = new Date("2026-03-15T09:30:00Z").toLocaleDateString(undefined, {
      timeZone: HOTEL_TIMEZONE,
    });
    expect(formatDisplayDate("2026-03-15T09:30:00Z")).toBe(bare);
  });
});

describe("date arithmetic (existing behaviour)", () => {
  it("rangesOverlap is half-open and treats touching ranges as non-overlapping", () => {
    const a = [new Date("2026-10-01"), new Date("2026-10-03")] as const;
    const b = [new Date("2026-10-03"), new Date("2026-10-05")] as const;
    expect(rangesOverlap(a[0], a[1], b[0], b[1])).toBe(false);
    expect(rangesOverlap(a[0], a[1], new Date("2026-10-02"), new Date("2026-10-04"))).toBe(true);
  });

  it("addDays handles month boundaries", () => {
    expect(addDays(new Date("2026-10-31T12:00:00Z"), 1).getUTCDate()).toBe(1);
  });

  it("startOfWeek returns a Monday at local midnight", () => {
    const monday = startOfWeek(new Date("2026-10-07T15:00:00")); // a Wednesday
    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    // The Monday of the week containing 2026-10-07 is 2026-10-05.
    expect(monday.getDate()).toBe(5);
  });
});
