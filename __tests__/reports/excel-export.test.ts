import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildReportsWorkbook } from "../../lib/report-export";

/**
 * Guards the Excel export, which had no tests at all before this.
 *
 * The specific thing being pinned down: the old "Booking History" sheet had one
 * `Rooms` column holding `07 (Single — Bed Only)` — room number and occupancy
 * welded into one cell. It is now two columns, `Room` and `Occupancy`, so the
 * sheet can be filtered and pivoted on either.
 *
 * The failure mode this test exists for is a *silent* one: splitting a column
 * means every row must gain exactly one cell and `widths` must gain exactly one
 * entry. Get that wrong and the file still opens — it just quietly shifts every
 * column after it (Status under Occupancy, and so on) or drops the last field.
 */

/** Minimal but complete ReportExportData. Typechecked against the real signature. */
export function __fixtureForPreview() {
  return {
    range: { startDate: "2026-10-01", endDate: "2026-10-31" },
    billed: [{ type: "Room", total: 5000 }],
    billedTotal: 5000,
    collected: [{ method: "Cash", total: 5000 }],
    collectedTotal: 5000,
    expensesBreakdown: [{ category: "Supplies", total: 1000 }],
    expensesTotal: 1000,
    netCashFlow: 4000,
    bookingSummary: {
      totalBookings: 2,
      statusCounts: { CHECKED_IN: 1, RESERVED: 1 },
      bookedAccommodation: 5000,
      cancelledAccommodation: 0,
      totalBilled: 5000,
      amountPaid: 5000,
      balanceDue: 0,
      creditBalance: 0,
    },
    bookingHistory: [
      {
        code: "RSV-0001",
        guest: { fullName: "FRANCIS", phone: "0700000000", email: null },
        checkInDate: "2026-10-03T00:00:00.000Z",
        checkOutDate: "2026-10-04T00:00:00.000Z",
        status: "CHECKED_IN",
        source: "WALK_IN",
        adults: 2,
        children: 0,
        // Two rooms, to prove the two columns stay index-paired.
        rooms: [
          { number: "07", roomType: "Single — Bed Only", nightlyRate: 2000 },
          { number: "12", roomType: "Double — B&B", nightlyRate: 3300 },
        ],
        bookedAccommodation: 5300,
        cancelledAccommodation: 0,
        accommodationSpent: 5300,
        restaurantSpent: 0,
        otherSpent: 0,
        totalBilled: 5300,
        amountPaid: 5300,
        balance: 0,
      },
      {
        code: "RSV-0002",
        guest: { fullName: "MARY", phone: null, email: "mary@example.com" },
        checkInDate: "2026-10-05T00:00:00.000Z",
        checkOutDate: "2026-10-06T00:00:00.000Z",
        status: "RESERVED",
        source: "PHONE",
        adults: 1,
        children: 0,
        rooms: [], // a booking with no room yet must not shift the row
        bookedAccommodation: 0,
        cancelledAccommodation: 0,
        accommodationSpent: 0,
        restaurantSpent: 0,
        otherSpent: 0,
        totalBilled: 0,
        amountPaid: 0,
        balance: 0,
      },
    ],
    restaurant: {
      summary: {
        revenue: 0,
        itemsSold: 0,
        saleLines: 0,
        payNowRevenue: 0,
        roomChargeRevenue: 0,
      },
      topItems: [],
      sales: [],
    },
    inventory: {
      summary: {
        activeItems: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        currentStockValue: 0,
        usageCost: 0,
        wastageCost: 0,
      },
      items: [],
    },
  };
}

/** Booking History is the 2nd sheet, so sheet2.xml. */
function bookingSheetXml(): string {
  const files = unzipSync(buildReportsWorkbook(__fixtureForPreview() as any));
  return strFromU8(files["xl/worksheets/sheet2.xml"]);
}

/** The export escapes `&` etc. on the way in; undo that to compare real values. */
function xmlUnescape(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&"); // last, or "&amp;lt;" would double-decode
}

/**
 * Reads a sheet back into `string | number` cells, keyed by row number.
 * Deliberately parses the generated XML rather than trusting the input arrays —
 * that is what makes this a test of the export and not of the fixture.
 */
function readRows(xml: string): Map<number, (string | number)[]> {
  const rows = new Map<number, (string | number)[]>();
  for (const rowMatch of xml.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)) {
    const cells: (string | number)[] = [];
    for (const cell of rowMatch[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = cell[2] ?? "";
      const text = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      const number = body.match(/<v>([\s\S]*?)<\/v>/);
      if (text) cells.push(xmlUnescape(text[1]));
      else if (number) cells.push(Number(number[1]));
      else cells.push("");
    }
    rows.set(Number(rowMatch[1]), cells);
  }
  return rows;
}

describe("Excel export — Booking History sheet", () => {
  const rows = readRows(bookingSheetXml());
  const header = rows.get(1)! as string[];

  it("has Room and Occupancy as two separate columns", () => {
    expect(header).toContain("Room");
    expect(header).toContain("Occupancy");
    // The combined column is gone.
    expect(header).not.toContain("Rooms");
    expect(header.filter((h) => h === "Room" || h === "Occupancy")).toHaveLength(2);
  });

  it("puts Occupancy immediately after Room, in the old column's place", () => {
    expect(header.indexOf("Room")).toBe(5); // column F, where "Rooms" used to be
    expect(header.indexOf("Occupancy")).toBe(header.indexOf("Room") + 1);
    // Everything after is unchanged and still in order.
    expect(header.slice(header.indexOf("Occupancy") + 1)).toEqual([
      "Meal Plan",
      "Status",
      "Source",
      "Adults",
      "Children",
      "Booked Accommodation",
      "Cancelled Amount",
      "Accommodation Spend",
      "Restaurant Spend",
      "Other Spend",
      "Total Spend",
      "Amount Paid",
      "Balance",
    ]);
  });

  it("never writes room number and occupancy into the same cell", () => {
    const firstRow = rows.get(2)! as string[];
    expect(firstRow[header.indexOf("Room")]).toBe("07, 12");
    expect(firstRow[header.indexOf("Occupancy")]).toBe("Single, Double");
    expect(firstRow[header.indexOf("Meal Plan")]).toBe("Bed Only, B&B");

    // The exact string the old single column produced must be gone.
    expect(bookingSheetXml()).not.toContain("07 (Single — Bed Only)");
  });

  it("keeps the two lists index-paired when a booking has several rooms", () => {
    const firstRow = rows.get(2)! as string[];
    const numbers = String(firstRow[header.indexOf("Room")]).split(", ");
    const occupancies = String(firstRow[header.indexOf("Occupancy")]).split(", ");
    expect(numbers).toHaveLength(2);
    expect(occupancies).toHaveLength(2);
    expect(numbers[0]).toBe("07");
    expect(occupancies[0]).toBe("Single");
    expect(numbers[1]).toBe("12");
    expect(occupancies[1]).toBe("Double");
  });

  it("leaves both cells empty for a booking with no room yet", () => {
    const secondRow = rows.get(3)! as string[];
    expect(secondRow[header.indexOf("Room")]).toBe("");
    expect(secondRow[header.indexOf("Occupancy")]).toBe("");
    // ...and the fields after it are not shifted.
    expect(secondRow[header.indexOf("Status")]).toBe("Reserved");
    expect(secondRow[header.indexOf("Balance")]).toBe(0);
  });

  it("keeps every row exactly as wide as the header", () => {
    for (const [rowNumber, cells] of rows) {
      expect(cells, `row ${rowNumber}`).toHaveLength(header.length);
    }
  });

  it("defines one column width per header, so the columns line up", () => {
    const widths = [...bookingSheetXml().matchAll(/<col min="\d+" max="\d+" width="\d+"/g)];
    expect(widths).toHaveLength(header.length);
  });

  it("writes the room as text, not as a number", () => {
    // "07" must stay "07" -- if Excel coerced it to 7 the zero-padding is lost,
    // which matters because the real rooms are numbered 01, 02, ... 41.
    const xml = bookingSheetXml();
    expect(xml).toContain('xml:space="preserve">07, 12<');
  });
});
