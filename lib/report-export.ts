import { strToU8, zipSync } from "fflate";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { HOTEL_TIMEZONE } from "@/lib/dates";

type ReportExportData = {
  range: { startDate: string; endDate: string };
  billed: { type: string; total: number }[];
  billedTotal: number;
  collected: { method: string; total: number }[];
  collectedTotal: number;
  expensesBreakdown: { category: string; total: number }[];
  expensesTotal: number;
  netCashFlow: number;
  bookingSummary: {
    totalBookings: number;
    statusCounts: Record<string, number>;
    bookedAccommodation: number;
    cancelledAccommodation?: number;
    totalBilled: number;
    amountPaid: number;
    balanceDue: number;
    creditBalance: number;
  };
  bookingHistory: {
    code: string;
    guest: { fullName: string; phone: string | null; email: string | null };
    checkInDate: string;
    checkOutDate: string;
    status: string;
    source: string;
    adults: number;
    children: number;
    rooms: { number: string; roomType: string; nightlyRate: number }[];
    bookedAccommodation: number;
    cancelledAccommodation?: number;
    accommodationSpent: number;
    restaurantSpent: number;
    otherSpent: number;
    totalBilled: number;
    amountPaid: number;
    balance: number;
  }[];
  restaurant: {
    summary: {
      revenue: number;
      itemsSold: number;
      saleLines: number;
      payNowRevenue: number;
      roomChargeRevenue: number;
    };
    topItems: { itemName: string; quantity: number; revenue: number }[];
    sales: {
      itemName: string;
      quantity: number;
      unitPrice: number;
      total: number;
      createdAt: string;
      channel: "PAY_NOW" | "ROOM_CHARGE";
      guestName: string;
      reservationCode: string | null;
      roomNumbers: string[];
    }[];
  };
  inventory: {
    summary: {
      activeItems: number;
      lowStockItems: number;
      outOfStockItems: number;
      currentStockValue: number;
      usageCost: number;
      wastageCost: number;
    };
    items: {
      sku: string;
      name: string;
      category: string;
      unit: string;
      isActive: boolean;
      currentStock: number;
      reorderLevel: number;
      status: string;
      usedInSales: number;
      wastage: number;
      adjustmentAdded: number;
      adjustmentRemoved: number;
      costPerUnit: number;
      currentValue: number;
      usageCost: number;
      wastageCost: number;
    }[];
  };
};

type StyledCell = {
  value: string | number;
  style?: "money" | "decimal";
};
type CellValue = string | number | null | StyledCell;
type Sheet = { name: string; rows: CellValue[][]; widths: number[] };

const TYPE_LABEL: Record<string, string> = {
  ROOM_CHARGE: "Room Charges",
  RESTAURANT: "Restaurant",
  LAUNDRY: "Laundry",
  OTHER_SERVICE: "Other Services",
  DISCOUNT: "Discounts",
  TAX: "Tax",
};

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function money(value: number): StyledCell {
  return { value, style: "money" };
}

function decimal(value: number): StyledCell {
  return { value, style: "decimal" };
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function worksheetXml(sheet: Sheet) {
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((rawCell, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (rawCell === null || rawCell === undefined) return `<c r="${reference}"/>`;

          const cell: StyledCell =
            typeof rawCell === "object" ? rawCell : { value: rawCell };
          const style = rowIndex === 0 ? 1 : cell.style === "money" ? 2 : cell.style === "decimal" ? 3 : 0;
          const styleAttribute = style ? ` s="${style}"` : "";

          if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
            return `<c r="${reference}"${styleAttribute}><v>${cell.value}</v></c>`;
          }

          return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${xmlEscape(
            String(cell.value)
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const columns = sheet.widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    )
    .join("");
  const lastColumn = columnName(Math.max(0, sheet.rows[0].length - 1));
  const lastRow = Math.max(1, sheet.rows.length);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>${rows}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

function workbookFiles(sheets: Sheet[]) {
  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const workbookSheets = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const workbookRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const now = new Date().toISOString();

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${sheetOverrides}
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Axis Hotel Management Report</dc:title><dc:creator>Axis Hotel HMS</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Axis Hotel HMS</Application></Properties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;KSh&quot; #,##0.00;[Red]-&quot;KSh&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B0244"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet));
  });
  return files;
}

function exportDate(value: string) {
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: HOTEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function parseTariff(roomType: string): { occupancy: string; mealPlan: string } {
  if (!roomType) return { occupancy: "", mealPlan: "" };
  const parts = roomType.split(/\s*[—–-]\s*/);
  if (parts.length >= 2) {
    return {
      occupancy: parts[0].trim(),
      mealPlan: parts.slice(1).join(" — ").trim(),
    };
  }
  return {
    occupancy: roomType.trim(),
    mealPlan: "",
  };
}

export function buildReportsWorkbook(data: ReportExportData) {
  const overviewRows: CellValue[][] = [
    ["Metric", "Value"],
    ["Report Start", data.range.startDate],
    ["Report End", data.range.endDate],
    ["Revenue Billed", money(data.billedTotal)],
    ["Cash Collected", money(data.collectedTotal)],
    ["Approved Expenses", money(data.expensesTotal)],
    ["Net Cash Flow", money(data.netCashFlow)],
    ["Restaurant Revenue", money(data.restaurant.summary.revenue)],
    ["Current Stock Value", money(data.inventory.summary.currentStockValue)],
    ["Bookings Overlapping Period", data.bookingSummary.totalBookings],
    ["Booked Accommodation (Excl. Cancelled)", money(data.bookingSummary.bookedAccommodation)],
    ["Cancelled Bookings Amount", money(data.bookingSummary.cancelledAccommodation ?? 0)],
  ];

  for (const item of data.billed) {
    overviewRows.push([`Billed - ${TYPE_LABEL[item.type] ?? humanize(item.type)}`, money(item.total)]);
  }
  for (const item of data.collected) {
    overviewRows.push([`Collected - ${item.method}`, money(item.total)]);
  }
  for (const item of data.expensesBreakdown) {
    overviewRows.push([`Expense - ${item.category}`, money(item.total)]);
  }

  const bookingRows: CellValue[][] = [
    [
      "Reservation",
      "Guest",
      "Phone / Email",
      "Check-in",
      "Check-out",
      "Room",
      "Occupancy",
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
    ],
    ...data.bookingHistory.map((booking) => [
      booking.code,
      booking.guest.fullName,
      booking.guest.phone ?? booking.guest.email ?? "",
      exportDate(booking.checkInDate),
      exportDate(booking.checkOutDate),
      // Room number and occupancy are separate columns. A booking can hold more
      // than one room, so each is a comma-separated list in the same order --
      // "07, 12" pairs with "Single - Bed Only, Double - Bed Only".
      booking.rooms.map((room) => room.number).join(", "),
      booking.rooms.map((room) => parseTariff(room.roomType).occupancy).join(", "),
      booking.rooms.map((room) => parseTariff(room.roomType).mealPlan).join(", "),
      humanize(booking.status),
      humanize(booking.source),
      booking.adults,
      booking.children,
      money(booking.bookedAccommodation),
      money(booking.cancelledAccommodation ?? 0),
      money(booking.accommodationSpent),
      money(booking.restaurantSpent),
      money(booking.otherSpent),
      money(booking.totalBilled),
      money(booking.amountPaid),
      money(booking.balance),
    ]),
  ];

  const restaurantRows: CellValue[][] = [
    ["Date", "Item", "Guest", "Reservation", "Rooms", "Sale Type", "Quantity", "Unit Price", "Revenue"],
    ...data.restaurant.sales.map((sale) => [
      exportDate(sale.createdAt),
      sale.itemName,
      sale.guestName,
      sale.reservationCode ?? "",
      sale.roomNumbers.join(", "),
      sale.channel === "PAY_NOW" ? "Paid Now" : "Room Charge",
      sale.quantity,
      money(sale.unitPrice),
      money(sale.total),
    ]),
  ];

  const stockRows: CellValue[][] = [
    [
      "SKU",
      "Item",
      "Category",
      "Unit",
      "Active",
      "Status",
      "Used in Meal Sales",
      "Wastage",
      "Adjustment Added",
      "Adjustment Removed",
      "Current Stock",
      "Reorder Level",
      "Cost per Unit",
      "Usage Cost",
      "Wastage Cost",
      "Current Value",
    ],
    ...data.inventory.items.map((item) => [
      item.sku,
      item.name,
      item.category,
      item.unit,
      item.isActive ? "Yes" : "No",
      humanize(item.status),
      decimal(item.usedInSales),
      decimal(item.wastage),
      decimal(item.adjustmentAdded),
      decimal(item.adjustmentRemoved),
      decimal(item.currentStock),
      decimal(item.reorderLevel),
      money(item.costPerUnit),
      money(item.usageCost),
      money(item.wastageCost),
      money(item.currentValue),
    ]),
  ];

  const sheets: Sheet[] = [
    { name: "Overview", rows: overviewRows, widths: [38, 22] },
    {
      name: "Booking History",
      rows: bookingRows,
      widths: [18, 24, 22, 14, 14, 14, 16, 18, 16, 16, 10, 10, 22, 20, 22, 20, 18, 18, 18, 18],
    },
    {
      name: "Restaurant Sales",
      rows: restaurantRows,
      widths: [14, 28, 24, 18, 15, 16, 12, 16, 16],
    },
    {
      name: "Stock",
      rows: stockRows,
      widths: [15, 26, 20, 10, 10, 16, 20, 14, 18, 20, 16, 16, 16, 16, 16, 18],
    },
  ];

  return zipSync(workbookFiles(sheets), { level: 6 });
}

function safePdfText(value: string) {
  return value
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfMoney(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

export async function buildReportsPdf(data: ReportExportData) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.043, 0.008, 0.267);
  const gold = rgb(0.859, 0.573, 0.122);
  const gray = rgb(0.42, 0.45, 0.41);
  const light = rgb(0.96, 0.96, 0.94);
  const green = rgb(0.18, 0.49, 0.27);
  const red = rgb(0.7, 0.15, 0.12);

  function addPage(title: string) {
    const page = document.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 790, width: 595.28, height: 51.89, color: navy });
    page.drawText("AXIS HOTEL", { x: 40, y: 812, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText(safePdfText(title), { x: 40, y: 765, size: 18, font: bold, color: navy });
    page.drawText(`${data.range.startDate} to ${data.range.endDate}`, {
      x: 40,
      y: 746,
      size: 9,
      font: regular,
      color: gray,
    });
    page.drawText(`Generated ${new Date().toLocaleString("en-KE")}`, {
      x: 390,
      y: 746,
      size: 8,
      font: regular,
      color: gray,
    });
    return page;
  }

  function drawKpis(
    page: PDFPage,
    values: { label: string; value: string; color?: ReturnType<typeof rgb> }[],
    top: number
  ) {
    const width = 247;
    const height = 54;
    values.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 40 + column * 267;
      const y = top - row * 66;
      page.drawRectangle({ x, y, width, height, color: light, borderColor: rgb(0.88, 0.87, 0.84), borderWidth: 0.5 });
      page.drawText(safePdfText(item.label), { x: x + 12, y: y + 34, size: 8, font: regular, color: gray });
      page.drawText(safePdfText(item.value), { x: x + 12, y: y + 14, size: 14, font: bold, color: item.color ?? navy });
    });
  }

  function drawBars(
    page: PDFPage,
    title: string,
    values: { label: string; value: number }[],
    top: number,
    height = 150
  ) {
    page.drawText(safePdfText(title), { x: 40, y: top, size: 12, font: bold, color: navy });
    const rows = values.filter((item) => item.value > 0).slice(0, 8);
    if (rows.length === 0) {
      page.drawText("No data for this period.", { x: 40, y: top - 22, size: 9, font: regular, color: gray });
      return;
    }
    const max = Math.max(...rows.map((item) => item.value), 1);
    const rowHeight = Math.min(20, (height - 20) / rows.length);
    rows.forEach((item, index) => {
      const y = top - 24 - index * rowHeight;
      const label = safePdfText(item.label).slice(0, 27);
      page.drawText(label, { x: 40, y, size: 8, font: regular, color: gray });
      const barWidth = (item.value / max) * 255;
      page.drawRectangle({ x: 190, y: y - 1, width: barWidth, height: 8, color: index % 2 ? gold : navy });
      page.drawText(pdfMoney(item.value), { x: 455, y, size: 8, font: regular, color: navy });
    });
  }

  function drawTable(
    page: PDFPage,
    title: string,
    headers: string[],
    rows: string[][],
    widths: number[],
    top: number
  ) {
    page.drawText(safePdfText(title), { x: 40, y: top, size: 12, font: bold, color: navy });
    let x = 40;
    const headerY = top - 24;
    page.drawRectangle({ x: 40, y: headerY - 5, width: widths.reduce((sum, width) => sum + width, 0), height: 18, color: navy });
    headers.forEach((header, index) => {
      page.drawText(safePdfText(header), { x: x + 3, y: headerY, size: 7, font: bold, color: rgb(1, 1, 1) });
      x += widths[index];
    });
    rows.forEach((row, rowIndex) => {
      const y = headerY - 19 - rowIndex * 17;
      if (rowIndex % 2 === 0) {
        page.drawRectangle({ x: 40, y: y - 4, width: widths.reduce((sum, width) => sum + width, 0), height: 16, color: light });
      }
      let cellX = 40;
      row.forEach((cell, cellIndex) => {
        const maxCharacters = Math.max(4, Math.floor(widths[cellIndex] / 4.4));
        page.drawText(safePdfText(cell).slice(0, maxCharacters), {
          x: cellX + 3,
          y,
          size: 7,
          font: regular,
          color: rgb(0.15, 0.16, 0.15),
        });
        cellX += widths[cellIndex];
      });
    });
  }

  const overview = addPage("Management Report - Executive Summary");
  drawKpis(
    overview,
    [
      { label: "Revenue Billed", value: pdfMoney(data.billedTotal) },
      { label: "Cash Collected", value: pdfMoney(data.collectedTotal), color: green },
      { label: "Approved Expenses", value: pdfMoney(data.expensesTotal), color: red },
      { label: "Net Cash Flow", value: pdfMoney(data.netCashFlow), color: data.netCashFlow >= 0 ? green : red },
      { label: "Restaurant Revenue", value: pdfMoney(data.restaurant.summary.revenue) },
      { label: "Current Stock Value", value: pdfMoney(data.inventory.summary.currentStockValue) },
    ],
    675
  );
  drawBars(
    overview,
    "Billed Revenue by Category",
    data.billed.map((item) => ({ label: TYPE_LABEL[item.type] ?? humanize(item.type), value: item.total })),
    455,
    145
  );
  drawBars(
    overview,
    "Cash Collected by Method",
    data.collected.map((item) => ({ label: item.method, value: item.total })),
    275,
    130
  );

  const commercial = addPage("Booking and Restaurant Summary");
  drawKpis(
    commercial,
    [
      { label: "Bookings Overlapping Period", value: data.bookingSummary.totalBookings.toLocaleString() },
      { label: "Total Guest Spend", value: pdfMoney(data.bookingSummary.totalBilled) },
      { label: "Amount Paid", value: pdfMoney(data.bookingSummary.amountPaid), color: green },
      { label: "Balance Due", value: pdfMoney(data.bookingSummary.balanceDue), color: red },
      { label: "Restaurant Items Sold", value: data.restaurant.summary.itemsSold.toLocaleString() },
      { label: "Charged to Rooms", value: pdfMoney(data.restaurant.summary.roomChargeRevenue) },
    ],
    675
  );
  drawBars(
    commercial,
    "Booking Status",
    Object.entries(data.bookingSummary.statusCounts).map(([status, count]) => ({ label: humanize(status), value: count })),
    455,
    140
  );
  drawTable(
    commercial,
    "Top Restaurant Items",
    ["Item", "Quantity", "Revenue"],
    data.restaurant.topItems.slice(0, 10).map((item) => [item.itemName, String(item.quantity), pdfMoney(item.revenue)]),
    [260, 90, 160],
    275
  );

  const inventory = addPage("Inventory Summary");
  drawKpis(
    inventory,
    [
      { label: "Active Items", value: data.inventory.summary.activeItems.toLocaleString() },
      { label: "Low / Out of Stock", value: data.inventory.summary.lowStockItems.toLocaleString(), color: red },
      { label: "Current Stock Value", value: pdfMoney(data.inventory.summary.currentStockValue) },
      { label: "Meal Sales Usage Cost", value: pdfMoney(data.inventory.summary.usageCost) },
      { label: "Wastage Cost", value: pdfMoney(data.inventory.summary.wastageCost), color: red },
      { label: "Out of Stock", value: data.inventory.summary.outOfStockItems.toLocaleString(), color: red },
    ],
    675
  );
  drawBars(
    inventory,
    "Highest Stock Usage and Wastage Cost",
    data.inventory.items
      .map((item) => ({ label: item.name, value: item.usageCost + item.wastageCost }))
      .sort((a, b) => b.value - a.value),
    455,
    150
  );
  const lowStock = data.inventory.items
    .filter((item) => item.isActive && item.status !== "IN_STOCK")
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 15);
  drawTable(
    inventory,
    "Items Requiring Attention",
    ["Item", "Category", "Status", "Current", "Reorder"],
    lowStock.map((item) => [
      item.name,
      item.category,
      humanize(item.status),
      `${item.currentStock.toLocaleString()} ${item.unit}`,
      `${item.reorderLevel.toLocaleString()} ${item.unit}`,
    ]),
    [145, 105, 90, 85, 85],
    265
  );

  document.setTitle("Axis Hotel Management Report");
  document.setAuthor("Axis Hotel HMS");
  document.setSubject(`${data.range.startDate} to ${data.range.endDate}`);
  return document.save();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadReportsExcel(data: ReportExportData) {
  const bytes = buildReportsWorkbook(data);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `axis-hotel-report-${data.range.startDate}-to-${data.range.endDate}.xlsx`
  );
}

export async function downloadReportsPdf(data: ReportExportData) {
  const bytes = await buildReportsPdf(data);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  downloadBlob(
    new Blob([buffer], { type: "application/pdf" }),
    `axis-hotel-report-${data.range.startDate}-to-${data.range.endDate}.pdf`
  );
}
