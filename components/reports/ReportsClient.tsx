"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  BarChart3, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  ChevronDown,
  Calendar,
  Wallet,
  TrendingUp,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Boxes,
  UtensilsCrossed,
  PackageSearch
} from "lucide-react";
import {
  formatQty,
  STOCK_STATUS_BADGE_CLASS,
  STOCK_STATUS_LABEL,
  type StockStatus,
} from "@/lib/inventory";
import { HOTEL_TIMEZONE } from "@/lib/dates";
import clsx from "clsx";

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
  cancelledAccommodation: number;
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
    cancelledAccommodation: number;
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

const STATUS_BADGE: Record<string, string> = {
  CHECKED_IN: "bg-teal-50 text-teal-700",
  CHECKED_OUT: "bg-navy-50 text-navy-700",
  CONFIRMED: "bg-success-bg text-success-text",
  CANCELLED: "bg-danger-bg text-danger",
  PENDING: "bg-warning-bg text-warning-text",
};

export default function ReportsClient({ initialData }: { initialData: ReportData }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function downloadReport(format: "excel" | "pdf") {
    if (!data || exporting) return;
    setExportError(null);
    setExporting(format);
    try {
      const exporter = await import("@/lib/report-export");
      if (format === "excel") exporter.downloadReportsExcel(data);
      else await exporter.downloadReportsPdf(data);
    } catch (err) {
      console.error(err);
      setExportError(`Could not create the ${format === "excel" ? "Excel" : "PDF"} report.`);
    } finally {
      setExporting(null);
    }
  }

  const formatMoney = (val: number) => 
    `KSh ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (iso: string) => 
    new Date(iso).toLocaleDateString(undefined, { timeZone: HOTEL_TIMEZONE, month: "short", day: "numeric" });

  const humanize = (s: string) => s.toLowerCase().split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="animate-slide-up space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-500">Business Reports</h1>
          <p className="text-text-secondary mt-1 font-medium text-sm">
            Financial performance from <span className="text-navy-900 font-bold">{data.range.startDate}</span> to <span className="text-navy-900 font-bold">{data.range.endDate}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadReport("excel")}
            disabled={exporting !== null}
            className="btn-secondary hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700"
          >
            <FileSpreadsheet size={18} className="text-success" />
            {exporting === "excel" ? "Exporting Excel..." : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={() => downloadReport("pdf")}
            disabled={exporting !== null}
            className="btn-secondary hover:bg-navy-50 hover:border-navy-200 hover:text-navy-700"
          >
            <FileText size={18} className="text-navy-500" />
            {exporting === "pdf" ? "Exporting PDF..." : "Export PDF"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="bg-danger-bg border border-danger/20 p-4 rounded-xl flex items-center gap-3 text-danger shadow-sm">
          <AlertCircle size={18} />
          <p className="text-sm font-bold">{exportError}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-sm p-1.5 flex gap-1 w-full max-w-2xl">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "bookings", label: "Booking History", icon: Calendar },
          { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
          { id: "inventory", label: "Inventory", icon: Boxes },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              activeTab === t.id ? "bg-navy-500 text-white shadow-md" : "text-text-secondary hover:bg-bg"
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard icon={TrendingUp} label="Total Billed" value={formatMoney(data.billedTotal)} color="text-navy-600" bg="bg-navy-50" />
          <StatCard icon={Wallet} label="Cash Collected" value={formatMoney(data.collectedTotal)} color="text-success" bg="bg-success-bg" />
          <StatCard icon={BarChart3} label="Net Cash Flow" value={formatMoney(data.netCashFlow)} color="text-teal-600" bg="bg-teal-50" />
          
          <div className="card lg:col-span-2">
             <h3 className="mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                Revenue Breakdown
             </h3>
             <div className="space-y-4">
                {data.billed.map(item => (
                  <div key={item.type} className="flex items-center gap-4">
                     <span className="text-[11px] font-bold text-text-muted uppercase w-32 shrink-0">{humanize(item.type)}</span>
                     <div className="flex-1 h-3 bg-bg rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-navy-500/80 rounded-full" 
                          style={{ width: `${(item.total / (data.billedTotal || 1)) * 100}%` }}
                        />
                     </div>
                     <span className="text-xs font-bold text-navy-900 w-24 text-right">{formatMoney(item.total)}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="card">
             <h3 className="mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-gold-500 rounded-full" />
                Collection Methods
             </h3>
             <div className="space-y-3">
                {data.collected.map(item => (
                   <div key={item.method} className="flex justify-between items-center p-3 bg-bg/50 rounded-xl border border-border/40">
                      <span className="text-xs font-bold text-text-secondary">{item.method}</span>
                      <span className="text-sm font-black text-navy-500">{formatMoney(item.total)}</span>
                   </div>
                ))}
                {data.collected.length === 0 && (
                   <div className="py-6 text-center text-xs text-text-muted italic">No collections in this period</div>
                )}
             </div>
          </div>
        </div>
      )}

      {activeTab === "bookings" && (
        <div className="space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard mini label="Bookings" value={data.bookingSummary.totalBookings.toString()} />
              <StatCard mini label="Accom." value={formatMoney(data.bookingSummary.bookedAccommodation)} />
              <StatCard mini label="Cancelled" value={formatMoney(data.bookingSummary.cancelledAccommodation)} color="text-danger" />
              <StatCard mini label="Total Spend" value={formatMoney(data.bookingSummary.totalBilled)} />
              <StatCard mini label="Amt Paid" value={formatMoney(data.bookingSummary.amountPaid)} color="text-success" />
              <StatCard mini label="Bal Due" value={formatMoney(data.bookingSummary.balanceDue)} color="text-warning" />
           </div>

           <div className="table-container shadow-sm border-border/60">
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Ref / Guest</th>
                      <th>Dates / Rooms</th>
                      <th>Status</th>
                      <th className="text-right">Booked</th>
                      <th className="text-right">Cancelled</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookingHistory.map(b => (
                      <tr key={b.id}>
                        <td>
                          <p className="font-bold text-navy-500">{b.code}</p>
                          <p className="text-[11px] text-text-secondary uppercase font-medium">{b.guest.fullName}</p>
                        </td>
                        <td>
                          <p className="font-medium text-xs">{formatDate(b.checkInDate)} – {formatDate(b.checkOutDate)}</p>
                          <p className="text-[10px] text-text-muted italic">{b.rooms.map(r => r.number).join(", ") || "No room"}</p>
                        </td>
                        <td>
                          <span className={clsx("badge", STATUS_BADGE[b.status] || "bg-bg")}>
                            {humanize(b.status)}
                          </span>
                        </td>
                        <td className="text-right font-medium text-xs">{formatMoney(b.bookedAccommodation)}</td>
                        <td className={clsx("text-right font-bold text-xs", b.cancelledAccommodation > 0 ? "text-danger" : "text-text-muted opacity-40")}>
                          {formatMoney(b.cancelledAccommodation)}
                        </td>
                        <td className="text-right font-black text-xs text-navy-900">{formatMoney(b.totalBilled)}</td>
                        <td className="text-right font-bold text-xs text-success">{formatMoney(b.amountPaid)}</td>
                        <td className={clsx("text-right font-black text-xs", b.balance > 0 ? "text-danger" : "text-success")}>
                          {formatMoney(b.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.bookingHistory.length === 0 && (
                  <div className="py-12 text-center text-sm text-text-muted italic">No bookings found for this range</div>
                )}
              </div>
           </div>
        </div>
      )}

      {activeTab === "restaurant" && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={TrendingUp} label="Total Sales" value={formatMoney(data.restaurant.summary.revenue)} color="text-navy-600" bg="bg-navy-50" />
              <StatCard icon={CheckCircle2} label="Items Sold" value={data.restaurant.summary.itemsSold.toLocaleString()} color="text-success" bg="bg-success-bg" />
              <StatCard icon={Wallet} label="Paid Now" value={formatMoney(data.restaurant.summary.payNowRevenue)} color="text-teal-600" bg="bg-teal-50" />
              <StatCard icon={Calendar} label="Room Charges" value={formatMoney(data.restaurant.summary.roomChargeRevenue)} color="text-gold-600" bg="bg-gold-50" />
           </div>

           <div className="table-container shadow-sm">
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Menu Item</th>
                      <th>Guest / Room</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Total</th>
                      <th>Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.restaurant.sales.map(s => (
                      <tr key={s.id}>
                        <td className="text-xs text-text-muted">{new Date(s.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className="font-bold text-navy-700">{s.itemName}</td>
                        <td>
                           <p className="text-xs font-medium">{s.guestName}</p>
                           <p className="text-[10px] text-text-muted italic">{s.roomNumbers.length > 0 ? `Room ${s.roomNumbers.join(", ")}` : "Walk-in"}</p>
                        </td>
                        <td className="text-center font-bold text-navy-500">{s.quantity}</td>
                        <td className="text-right text-xs">{formatMoney(s.unitPrice)}</td>
                        <td className="text-right font-black text-navy-900">{formatMoney(s.total)}</td>
                        <td>
                           <span className={clsx("badge", s.channel === "PAY_NOW" ? "bg-success-bg text-success-text" : "bg-teal-50 text-teal-700")}>
                             {s.channel === "PAY_NOW" ? "Paid Now" : "Charged"}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.restaurant.sales.length === 0 && (
                   <div className="py-12 text-center text-sm text-text-muted italic">No restaurant sales recorded</div>
                )}
              </div>
           </div>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={Boxes} label="Active Items" value={data.inventory.summary.activeItems.toString()} color="text-navy-600" bg="bg-navy-50" />
              <StatCard icon={TrendingUp} label="Total Value" value={formatMoney(data.inventory.summary.currentStockValue)} color="text-success" bg="bg-success-bg" />
              <StatCard icon={PackageSearch} label="Usage Cost" value={formatMoney(data.inventory.summary.usageCost)} color="text-teal-600" bg="bg-teal-50" />
              <StatCard icon={AlertCircle} label="Wastage" value={formatMoney(data.inventory.summary.wastageCost)} color="text-danger" bg="bg-danger-bg" />
           </div>

           <div className="table-container shadow-sm">
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>SKU / Name</th>
                      <th>Category</th>
                      <th className="text-right">Stock</th>
                      <th>Status</th>
                      <th className="text-right">Usage</th>
                      <th className="text-right">Wastage</th>
                      <th className="text-right">Current Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inventory.items.map(i => (
                      <tr key={i.id}>
                        <td>
                           <p className="text-[10px] font-black text-text-muted tracking-widest">{i.sku}</p>
                           <p className="font-bold text-navy-700">{i.name}</p>
                        </td>
                        <td className="text-xs uppercase font-medium text-text-secondary">{i.category}</td>
                        <td className="text-right font-black text-navy-600">{formatQty(i.currentStock, i.unit)}</td>
                        <td>
                           <span className={clsx("badge", STOCK_STATUS_BADGE_CLASS[i.status])}>
                             {STOCK_STATUS_LABEL[i.status]}
                           </span>
                        </td>
                        <td className="text-right text-xs font-medium text-navy-500">{formatMoney(i.usageCost)}</td>
                        <td className="text-right text-xs font-medium text-danger">{formatMoney(i.wastageCost)}</td>
                        <td className="text-right font-black text-navy-900">{formatMoney(i.currentValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = "text-navy-500", bg = "bg-white", mini = false, note }: any) {
  if (mini) return (
    <div className="card p-4 border-border/50">
       <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.15em]">{label}</p>
       <p className={clsx("text-sm font-black mt-1.5", color)}>{value}</p>
    </div>
  );

  return (
    <div className="card border-border/50 group hover:border-navy-200">
      <div className="flex items-center gap-4">
        <div className={clsx("p-3.5 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm", bg, color)}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">{label}</p>
          <p className={clsx("text-xl font-black mt-0.5", color)}>{value}</p>
          {note && <p className="text-[10px] text-text-muted mt-0.5 font-medium">{note}</p>}
        </div>
      </div>
    </div>
  );
}
