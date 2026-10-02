"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import {
  formatQty,
  STOCK_STATUS_BADGE_CLASS,
  STOCK_STATUS_LABEL,
  type StockStatus,
} from "@/lib/inventory";
import { HOTEL_TIMEZONE } from "@/lib/dates";

type BookingRow = {
  id: string;
  code: string;
  guest: { id: string; fullName: string; phone: string | null; email: string | null };
  checkInDate: string;
  checkOutDate: string;
  createdAt: string;
  status: string;
  source: string;
  adults: number;
  children: number;
  rooms: { number: string; roomType: string; nightlyRate: number }[];
  bookedAccommodation: number;
  accommodationSpent: number;
  restaurantSpent: number;
  otherSpent: number;
  totalBilled: number;
  amountPaid: number;
  balance: number;
  folioCount: number;
  foliosClosed: boolean;
};

type RestaurantSale = {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  channel: "PAY_NOW" | "ROOM_CHARGE";
  guestName: string;
  reservationCode: string | null;
  roomNumbers: string[];
  folioClosed: boolean;
};

type StockRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  isActive: boolean;
  currentStock: number;
  reorderLevel: number;
  status: StockStatus;
  usedInSales: number;
  wastage: number;
  adjustmentAdded: number;
  adjustmentRemoved: number;
  costPerUnit: number;
  currentValue: number;
  usageCost: number;
  wastageCost: number;
};

type ReportData = {
  range: {
    start: string;
    end: string;
    startDate: string;
    endDate: string;
    timeZone: string;
    bookingBasis: "STAY_OVERLAP";
  };
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
    totalBilled: number;
    amountPaid: number;
    balanceDue: number;
    creditBalance: number;
  };
  bookingHistory: BookingRow[];
  restaurant: {
    summary: {
      revenue: number;
      itemsSold: number;
      saleLines: number;
      payNowRevenue: number;
      roomChargeRevenue: number;
    };
    revenueByDay: { date: string; revenue: number }[];
    topItems: { itemName: string; quantity: number; revenue: number }[];
    sales: RestaurantSale[];
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
    items: StockRow[];
  };
};

type Tab = "overview" | "bookings" | "restaurant" | "inventory";

const TYPE_LABEL: Record<string, string> = {
  ROOM_CHARGE: "Room Charges",
  RESTAURANT: "Restaurant",
  LAUNDRY: "Laundry",
  OTHER_SERVICE: "Other Services",
  DISCOUNT: "Discounts",
  TAX: "Tax",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  CONFIRMED: "bg-primary/10 text-primary",
  CHECKED_IN: "bg-success/10 text-success",
  CHECKED_OUT: "bg-text-primary/10 text-text-secondary",
  CANCELLED: "bg-danger/10 text-danger",
  NO_SHOW: "bg-danger/10 text-danger",
};

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number) {
  return `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    timeZone: HOTEL_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function StatCard({
  label,
  value,
  tone = "default",
  note,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "warning";
  note?: string;
}) {
  const toneClass = {
    default: "text-text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
  }[tone];

  return (
    <div className="card">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</p>
      {note && <p className="text-xs text-text-muted mt-1">{note}</p>}
    </div>
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card min-w-0 overflow-hidden">
      <h3>{title}</h3>
      {note && <p className="text-xs text-text-muted mt-1 mb-3">{note}</p>}
      <div className="w-full min-w-0 min-h-[288px] mt-3">{children}</div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="min-h-[288px] flex flex-col items-center justify-center text-text-muted text-sm">
      <BarChart3 size={28} className="mb-2 opacity-50" />
      {message}
    </div>
  );
}

function DonutGraph({
  data,
  valueFormatter,
}: {
  data: { name: string; value: number }[];
  valueFormatter: (value: number) => string;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const visible =
    sorted.length <= 7
      ? sorted
      : [
          ...sorted.slice(0, 6),
          {
            name: "Other",
            value: sorted.slice(6).reduce((sum, item) => sum + item.value, 0),
          },
        ];
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="min-h-[288px] flex flex-col sm:flex-row items-center justify-center gap-6">
      <svg
        viewBox="0 0 180 180"
        width="180"
        height="180"
        className="block shrink-0"
        role="img"
        aria-label={`Total ${valueFormatter(total)}`}
      >
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#F0EFEA" strokeWidth="34" />
        {visible.map((item, index) => {
          const length = total > 0 ? (item.value / total) * circumference : 0;
          const circle = (
            <circle
              key={item.name}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth="34"
              strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            />
          );
          offset += length;
          return circle;
        })}
        <text x="90" y="84" textAnchor="middle" fontSize="10" fill="#6B7268">
          Total
        </text>
        <text x="90" y="103" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0B0244">
          {valueFormatter(total).slice(0, 18)}
        </text>
      </svg>
      <div className="w-full max-w-xs space-y-2">
        {visible.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate text-text-secondary">{item.name}</span>
            </span>
            <span className="font-medium text-text-primary">{valueFormatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBarGraph({
  data,
  valueFormatter,
  color = "#0B0244",
  maxItems = 8,
}: {
  data: { name: string; value: number }[];
  valueFormatter: (value: number) => string;
  color?: string;
  maxItems?: number;
}) {
  const rows = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
  const maximum = Math.max(...rows.map((item) => item.value), 1);

  return (
    <div className="min-h-[288px] flex flex-col justify-center gap-3 py-2">
      {rows.map((item) => (
        <div key={item.name}>
          <div className="flex items-center justify-between gap-3 text-xs mb-1">
            <span className="text-text-secondary truncate">{item.name}</span>
            <span className="font-medium shrink-0">{valueFormatter(item.value)}</span>
          </div>
          <div className="h-3 rounded-full bg-[#F0EFEA] overflow-hidden">
            <div
              className="h-full rounded-full min-w-[3px]"
              style={{ width: `${Math.max(0, (item.value / maximum) * 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueLineGraph({ data }: { data: { date: string; revenue: number }[] }) {
  const width = 680;
  const height = 270;
  const left = 58;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(...data.map((item) => item.revenue), 1);
  const points = data.map((item, index) => {
    const ratio = data.length === 1 ? 0.5 : index / (data.length - 1);
    return {
      ...item,
      x: left + ratio * plotWidth,
      y: top + plotHeight - (item.revenue / maximum) * plotHeight,
    };
  });
  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="min-h-[288px] w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full min-w-[520px] h-[288px]"
        role="img"
        aria-label="Restaurant revenue by day"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + plotHeight - ratio * plotHeight;
          return (
            <g key={ratio}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="#E7E5E0" strokeWidth="1" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6B7268">
                {(maximum * ratio).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="4" fill="#2563eb" stroke="#FFFFFF" strokeWidth="2" />
            {(index % labelStep === 0 || index === points.length - 1) && (
              <text x={point.x} y={height - 16} textAnchor="middle" fontSize="10" fill="#6B7268">
                {shortDate(point.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function StockCostGraph({
  data,
}: {
  data: { name: string; salesUsage: number; wastage: number }[];
}) {
  const maximum = Math.max(...data.map((item) => item.salesUsage + item.wastage), 1);

  return (
    <div className="min-h-[288px] flex flex-col justify-center gap-3 py-2">
      <div className="flex justify-end gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#2563eb]" />Meal sales usage</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#dc2626]" />Wastage</span>
      </div>
      {data.map((item) => (
        <div key={item.name}>
          <div className="flex items-center justify-between gap-3 text-xs mb-1">
            <span className="text-text-secondary truncate">{item.name}</span>
            <span className="font-medium shrink-0">{formatMoney(item.salesUsage + item.wastage)}</span>
          </div>
          <div className="h-3 rounded-full bg-[#F0EFEA] overflow-hidden flex">
            <div
              className="h-full bg-[#2563eb]"
              style={{ width: `${Math.max(0, (item.salesUsage / maximum) * 100)}%` }}
            />
            <div
              className="h-full bg-[#dc2626]"
              style={{ width: `${Math.max(0, (item.wastage / maximum) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReportsClient() {
  const [start, setStart] = useState(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [end, setEnd] = useState(() => toInputDate(new Date()));
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [loading, setLoading] = useState(true);

  function load(selectedStart: string, selectedEnd: string) {
    setError(null);
    setLoading(true);
    fetch(`/api/reports?start=${encodeURIComponent(selectedStart)}&end=${encodeURIComponent(selectedEnd)}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Could not load the report.");
        }
        return response.json();
      })
      .then(setData)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(start, end);
    // Load the default range only once. Date changes are applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset: "week" | "month" | "year") {
    const today = new Date();
    let from: Date;
    if (preset === "week") {
      from = new Date(today);
      from.setDate(today.getDate() - 6);
    } else if (preset === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      from = new Date(today.getFullYear(), 0, 1);
    }
    const selectedStart = toInputDate(from);
    const selectedEnd = toInputDate(today);
    setStart(selectedStart);
    setEnd(selectedEnd);
    load(selectedStart, selectedEnd);
  }

  async function downloadReport(format: "excel" | "pdf") {
    if (!data || exporting) return;
    setExportError(null);
    setExporting(format);
    try {
      const exporter = await import("@/lib/report-export");
      if (format === "excel") exporter.downloadReportsExcel(data);
      else await exporter.downloadReportsPdf(data);
    } catch (downloadError) {
      console.error(downloadError);
      setExportError(`Could not create the ${format === "excel" ? "Excel" : "PDF"} report.`);
    } finally {
      setExporting(null);
    }
  }

  const stockValueByCategory = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, number>();
    for (const item of data.inventory.items) {
      if (!item.isActive) continue;
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.currentValue);
    }
    return [...totals.entries()]
      .map(([category, value]) => ({ category, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const stockUsageChart = useMemo(() => {
    if (!data) return [];
    return data.inventory.items
      .filter((item) => item.usageCost > 0 || item.wastageCost > 0)
      .sort((a, b) => b.usageCost + b.wastageCost - (a.usageCost + a.wastageCost))
      .slice(0, 10)
      .map((item) => ({
        name: item.name,
        salesUsage: item.usageCost,
        wastage: item.wastageCost,
      }));
  }, [data]);

  const bookingStatusChart = data
    ? Object.entries(data.bookingSummary.statusCounts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({ name: STATUS_LABEL[status] ?? humanize(status), value: count }))
    : [];

  const billedChart = data
    ? data.billed
        .filter((item) => item.total > 0)
        .map((item) => ({ name: TYPE_LABEL[item.type] ?? humanize(item.type), value: item.total }))
    : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "bookings", label: "Booking History" },
    { id: "restaurant", label: "Restaurant" },
    { id: "inventory", label: "Stock" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1>Reports</h1>
          <p className="text-text-secondary text-sm mt-1">
            Financial performance, booking spend, restaurant revenue, and stock movement.
          </p>
        </div>
        {data && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => downloadReport("excel")}
              className="btn-secondary text-sm"
              disabled={loading || exporting !== null}
            >
              <FileSpreadsheet size={16} />
              {exporting === "excel" ? "Creating Excel…" : "Download Excel"}
            </button>
            <button
              onClick={() => downloadReport("pdf")}
              className="btn-secondary text-sm"
              disabled={loading || exporting !== null}
            >
              <FileText size={16} />
              {exporting === "pdf" ? "Creating PDF…" : "Download PDF"}
            </button>
            <p className="text-xs text-text-muted bg-background px-3 py-2 rounded-control border border-border">
              {formatDate(data.range.start)} – {formatDate(data.range.end)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyPreset("week")} className="btn-secondary text-xs">
            Last 7 Days
          </button>
          <button onClick={() => applyPreset("month")} className="btn-secondary text-xs">
            This Month
          </button>
          <button onClick={() => applyPreset("year")} className="btn-secondary text-xs">
            This Year
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-text-secondary block mb-1">From</label>
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="rounded-control border border-border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">To</label>
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="rounded-control border border-border px-2 py-1.5 text-sm"
            />
          </div>
          <button onClick={() => load(start, end)} className="btn-primary text-sm" disabled={loading}>
            Apply
          </button>
          <button
            onClick={() => load(start, end)}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Reload the numbers for the selected date range"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {exportError && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {exportError}
        </p>
      )}

      {loading && !data && <p className="text-sm text-text-secondary">Loading report...</p>}

      {data && (
        <>
          {loading && (
            <p className="text-xs text-text-muted mb-3 flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" /> Refreshing report…
            </p>
          )}

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <StatCard label="Revenue Billed" value={formatMoney(data.billedTotal)} />
                <StatCard label="Cash Collected" value={formatMoney(data.collectedTotal)} tone="success" />
                <StatCard label="Approved Expenses" value={formatMoney(data.expensesTotal)} tone="danger" />
                <StatCard
                  label="Net Cash Flow"
                  value={formatMoney(data.netCashFlow)}
                  tone={data.netCashFlow >= 0 ? "success" : "danger"}
                />
                <StatCard
                  label="Restaurant Revenue"
                  value={formatMoney(data.restaurant.summary.revenue)}
                  note="Completed sales"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Billed Revenue Mix" note="Charges posted inside the selected period.">
                  {billedChart.length === 0 ? (
                    <EmptyChart message="No billed revenue in this period." />
                  ) : (
                    <DonutGraph data={billedChart} valueFormatter={formatMoney} />
                  )}
                </ChartCard>

                <ChartCard title="Cash Collected by Method">
                  {data.collected.length === 0 ? (
                    <EmptyChart message="No completed payments in this period." />
                  ) : (
                    <HorizontalBarGraph
                      data={data.collected.map((item) => ({ name: item.method, value: item.total }))}
                      valueFormatter={formatMoney}
                      color="#16a34a"
                    />
                  )}
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card">
                  <h3 className="mb-3">Revenue Billed</h3>
                  <p className="text-xs text-text-muted mb-3">
                    Charges posted in this period. This is different from cash collected.
                  </p>
                  <div className="space-y-2">
                    {data.billed.map((item) => (
                      <div key={item.type} className="flex justify-between gap-3 text-sm">
                        <span className="text-text-secondary">{TYPE_LABEL[item.type] ?? humanize(item.type)}</span>
                        <span className="font-medium">{formatMoney(item.total)}</span>
                      </div>
                    ))}
                    {data.billed.length === 0 && <p className="text-sm text-text-secondary">No billed items.</p>}
                  </div>
                </div>

                <div className="card">
                  <h3 className="mb-3">Collected by Method</h3>
                  <div className="space-y-2">
                    {data.collected.map((item) => (
                      <div key={item.method} className="flex justify-between gap-3 text-sm">
                        <span className="text-text-secondary">{item.method}</span>
                        <span className="font-medium">{formatMoney(item.total)}</span>
                      </div>
                    ))}
                    {data.collected.length === 0 && <p className="text-sm text-text-secondary">No payments.</p>}
                  </div>
                </div>

                <div className="card">
                  <h3 className="mb-3">Approved Expenses</h3>
                  <div className="space-y-2">
                    {data.expensesBreakdown.map((item) => (
                      <div key={item.category} className="flex justify-between gap-3 text-sm">
                        <span className="text-text-secondary">{item.category}</span>
                        <span className="font-medium text-danger">{formatMoney(item.total)}</span>
                      </div>
                    ))}
                    {data.expensesBreakdown.length === 0 && <p className="text-sm text-text-secondary">No approved expenses.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "bookings" && (
            <div className="space-y-6">
              <p className="text-xs text-text-muted">
                Includes every stay that overlaps the selected dates. Spend and payment columns show the booking&apos;s complete folio history.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <StatCard label="Bookings" value={data.bookingSummary.totalBookings.toLocaleString()} />
                <StatCard label="Booked Accommodation" value={formatMoney(data.bookingSummary.bookedAccommodation)} />
                <StatCard label="Total Guest Spend" value={formatMoney(data.bookingSummary.totalBilled)} />
                <StatCard label="Amount Paid" value={formatMoney(data.bookingSummary.amountPaid)} tone="success" />
                <StatCard label="Balance Due" value={formatMoney(data.bookingSummary.balanceDue)} tone="warning" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <ChartCard title="Booking Status">
                  {bookingStatusChart.length === 0 ? (
                    <EmptyChart message="No bookings overlap this period." />
                  ) : (
                    <DonutGraph
                      data={bookingStatusChart}
                      valueFormatter={(value) => value.toLocaleString()}
                    />
                  )}
                </ChartCard>

                <div className="card xl:col-span-2 overflow-hidden">
                  <h3>Booking and Guest Spend History</h3>
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="text-left text-text-muted border-b border-border">
                        <tr>
                          <th className="py-2 pr-4">Reservation</th>
                          <th className="py-2 pr-4">Guest</th>
                          <th className="py-2 pr-4">Stay / Rooms</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Booked</th>
                          <th className="py-2 pr-4 text-right">Accommodation</th>
                          <th className="py-2 pr-4 text-right">Restaurant</th>
                          <th className="py-2 pr-4 text-right">Other</th>
                          <th className="py-2 pr-4 text-right">Total Spend</th>
                          <th className="py-2 pr-4 text-right">Paid</th>
                          <th className="py-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bookingHistory.map((booking) => (
                          <tr key={booking.id} className="border-b border-border/70 align-top">
                            <td className="py-3 pr-4">
                              <p className="font-medium">{booking.code}</p>
                              <p className="text-text-muted">{humanize(booking.source)}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <p>{booking.guest.fullName}</p>
                              <p className="text-text-muted">{booking.guest.phone ?? booking.guest.email ?? "—"}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <p>{formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}</p>
                              <p className="text-text-muted">
                                {booking.rooms.map((room) => `${room.number} (${room.roomType})`).join(", ") || "No room"}
                              </p>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`badge ${STATUS_CLASS[booking.status] ?? "bg-text-primary/10 text-text-secondary"}`}>
                                {STATUS_LABEL[booking.status] ?? humanize(booking.status)}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right">{formatMoney(booking.bookedAccommodation)}</td>
                            <td className="py-3 pr-4 text-right">{formatMoney(booking.accommodationSpent)}</td>
                            <td className="py-3 pr-4 text-right">{formatMoney(booking.restaurantSpent)}</td>
                            <td className="py-3 pr-4 text-right">{formatMoney(booking.otherSpent)}</td>
                            <td className="py-3 pr-4 text-right font-medium">{formatMoney(booking.totalBilled)}</td>
                            <td className="py-3 pr-4 text-right text-success">{formatMoney(booking.amountPaid)}</td>
                            <td className={`py-3 text-right font-medium ${booking.balance > 0 ? "text-danger" : ""}`}>
                              {formatMoney(booking.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.bookingHistory.length === 0 && (
                      <p className="text-sm text-text-secondary py-8 text-center">No bookings overlap this period.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "restaurant" && (
            <div className="space-y-6">
              <p className="text-xs text-text-muted">
                Completed restaurant sales recorded in the selected period. Includes pay-now and charge-to-room sales.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <StatCard label="Restaurant Revenue" value={formatMoney(data.restaurant.summary.revenue)} />
                <StatCard label="Items Sold" value={data.restaurant.summary.itemsSold.toLocaleString()} />
                <StatCard label="Sale Lines" value={data.restaurant.summary.saleLines.toLocaleString()} />
                <StatCard label="Paid Now" value={formatMoney(data.restaurant.summary.payNowRevenue)} tone="success" />
                <StatCard label="Charged to Rooms" value={formatMoney(data.restaurant.summary.roomChargeRevenue)} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Restaurant Revenue by Day">
                  {data.restaurant.revenueByDay.length === 0 ? (
                    <EmptyChart message="No restaurant sales in this period." />
                  ) : (
                    <RevenueLineGraph data={data.restaurant.revenueByDay} />
                  )}
                </ChartCard>

                <ChartCard title="Top Restaurant Items" note="Ranked by revenue.">
                  {data.restaurant.topItems.length === 0 ? (
                    <EmptyChart message="No restaurant items sold in this period." />
                  ) : (
                    <HorizontalBarGraph
                      data={data.restaurant.topItems.map((item) => ({
                        name: item.itemName,
                        value: item.revenue,
                      }))}
                      valueFormatter={formatMoney}
                      color="#7c3aed"
                    />
                  )}
                </ChartCard>
              </div>

              <div className="card overflow-hidden">
                <h3>Restaurant Sales History</h3>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="text-left text-text-muted border-b border-border">
                      <tr>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4">Guest / Room</th>
                        <th className="py-2 pr-4">Sale Type</th>
                        <th className="py-2 pr-4 text-right">Qty</th>
                        <th className="py-2 pr-4 text-right">Unit Price</th>
                        <th className="py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.restaurant.sales.map((sale) => (
                        <tr key={sale.id} className="border-b border-border/70">
                          <td className="py-3 pr-4">{formatDate(sale.createdAt)}</td>
                          <td className="py-3 pr-4 font-medium">{sale.itemName}</td>
                          <td className="py-3 pr-4">
                            <p>{sale.guestName}</p>
                            <p className="text-text-muted">
                              {sale.reservationCode ? `${sale.reservationCode} · Room ${sale.roomNumbers.join(", ")}` : "Walk-in"}
                            </p>
                          </td>
                          <td className="py-3 pr-4">{sale.channel === "PAY_NOW" ? "Paid Now" : "Room Charge"}</td>
                          <td className="py-3 pr-4 text-right">{sale.quantity}</td>
                          <td className="py-3 pr-4 text-right">{formatMoney(sale.unitPrice)}</td>
                          <td className="py-3 text-right font-medium">{formatMoney(sale.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.restaurant.sales.length === 0 && (
                    <p className="text-sm text-text-secondary py-8 text-center">No restaurant sales in this period.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="space-y-6">
              <p className="text-xs text-text-muted">
                Recipe usage, wastage, and adjustments use the selected dates. Current stock is today&apos;s live inventory balance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                <StatCard label="Active Items" value={data.inventory.summary.activeItems.toLocaleString()} />
                <StatCard label="Low / Out of Stock" value={data.inventory.summary.lowStockItems.toLocaleString()} tone="warning" />
                <StatCard label="Out of Stock" value={data.inventory.summary.outOfStockItems.toLocaleString()} tone="danger" />
                <StatCard label="Current Stock Value" value={formatMoney(data.inventory.summary.currentStockValue)} />
                <StatCard label="Stock Used in Sales" value={formatMoney(data.inventory.summary.usageCost)} />
                <StatCard label="Wastage Cost" value={formatMoney(data.inventory.summary.wastageCost)} tone="danger" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Stock Usage and Wastage Cost" note="Top 10 items by estimated cost in the selected period.">
                  {stockUsageChart.length === 0 ? (
                    <EmptyChart message="No recipe usage or wastage in this period." />
                  ) : (
                    <StockCostGraph data={stockUsageChart} />
                  )}
                </ChartCard>

                <ChartCard title="Current Stock Value by Category" note="Current live stock valued at each item’s recorded unit cost.">
                  {stockValueByCategory.length === 0 ? (
                    <EmptyChart message="No stock value is available." />
                  ) : (
                    <DonutGraph
                      data={stockValueByCategory.map((item) => ({
                        name: item.category,
                        value: item.value,
                      }))}
                      valueFormatter={formatMoney}
                    />
                  )}
                </ChartCard>
              </div>

              <div className="card overflow-hidden">
                <h3>Stock Usage and Current Stock</h3>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="text-left text-text-muted border-b border-border">
                      <tr>
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4 text-right">Used in Meals</th>
                        <th className="py-2 pr-4 text-right">Wastage</th>
                        <th className="py-2 pr-4 text-right">Adjustments +</th>
                        <th className="py-2 pr-4 text-right">Adjustments −</th>
                        <th className="py-2 pr-4 text-right">Current Stock</th>
                        <th className="py-2 pr-4 text-right">Reorder Level</th>
                        <th className="py-2 text-right">Current Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inventory.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/70">
                          <td className="py-3 pr-4">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-text-muted">{item.sku}{!item.isActive ? " · Inactive" : ""}</p>
                          </td>
                          <td className="py-3 pr-4">{item.category}</td>
                          <td className="py-3 pr-4">
                            <span className={STOCK_STATUS_BADGE_CLASS[item.status]}>{STOCK_STATUS_LABEL[item.status]}</span>
                          </td>
                          <td className="py-3 pr-4 text-right">{formatQty(item.usedInSales, item.unit)}</td>
                          <td className="py-3 pr-4 text-right text-danger">{formatQty(item.wastage, item.unit)}</td>
                          <td className="py-3 pr-4 text-right text-success">{formatQty(item.adjustmentAdded, item.unit)}</td>
                          <td className="py-3 pr-4 text-right text-danger">{formatQty(item.adjustmentRemoved, item.unit)}</td>
                          <td className="py-3 pr-4 text-right font-medium">{formatQty(item.currentStock, item.unit)}</td>
                          <td className="py-3 pr-4 text-right">{formatQty(item.reorderLevel, item.unit)}</td>
                          <td className="py-3 text-right font-medium">{formatMoney(item.currentValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.inventory.items.length === 0 && (
                    <p className="text-sm text-text-secondary py-8 text-center">No inventory records are available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
