"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type ReportData = {
  range: { start: string; end: string };
  billed: { type: string; total: number }[];
  billedTotal: number;
  collected: { method: string; total: number }[];
  collectedTotal: number;
  expensesBreakdown: { category: string; total: number }[];
  expensesTotal: number;
  netCashFlow: number;
};

const TYPE_LABEL: Record<string, string> = {
  ROOM_CHARGE: "Room Charges",
  RESTAURANT: "Restaurant",
  LAUNDRY: "Laundry",
  OTHER_SERVICE: "Other Services",
  DISCOUNT: "Discounts",
  TAX: "Tax",
};

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ReportsClient() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [start, setStart] = useState(toInputDate(monthStart));
  const [end, setEnd] = useState(toInputDate(now));
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(s: string, e: string) {
    setError(null);
    fetch(`/api/reports?start=${s}&end=${e}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Could not load the report.");
        }
        return r.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset: "week" | "month" | "year") {
    const today = new Date();
    let from: Date;
    if (preset === "week") {
      from = new Date(today);
      from.setDate(today.getDate() - 7);
    } else if (preset === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      from = new Date(today.getFullYear(), 0, 1);
    }
    const s = toInputDate(from);
    const e = toInputDate(today);
    setStart(s);
    setEnd(e);
    load(s, e);
  }

  return (
    <div>
      <h1>Reports</h1>
      <p className="text-text-secondary text-sm mt-1 mb-4">
        Billed revenue, cash actually collected, and approved expenses for a date range.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex gap-2">
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
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-text-secondary block mb-1">From</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-control border border-border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">To</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-control border border-border px-2 py-1.5 text-sm"
            />
          </div>
          <button onClick={() => load(start, end)} className="btn-primary text-sm">
            Apply
          </button>
          <button
            onClick={() => load(start, end)}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Reload the numbers for the current date range"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!data && !error && <p className="text-sm text-text-secondary">Loading...</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-xs text-text-muted">Cash Collected</p>
              <p className="text-xl font-semibold mt-1">KSh {data.collectedTotal.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="text-xs text-text-muted">Expenses (Approved)</p>
              <p className="text-xl font-semibold mt-1 text-danger">
                KSh {data.expensesTotal.toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-text-muted">Net Cash Flow</p>
              <p className={`text-xl font-semibold mt-1 ${data.netCashFlow >= 0 ? "text-success" : "text-danger"}`}>
                KSh {data.netCashFlow.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card">
              <h3 className="mb-3">Revenue Billed</h3>
              <p className="text-xs text-text-muted mb-3">
                What was charged in this period, by category. Not the same as cash collected — a charge can be billed now and paid later.
              </p>
              <div className="space-y-2">
                {data.billed.map((b) => (
                  <div key={b.type} className="flex justify-between text-sm">
                    <span className="text-text-secondary">{TYPE_LABEL[b.type] ?? b.type}</span>
                    <span className="font-medium">KSh {b.total.toLocaleString()}</span>
                  </div>
                ))}
                {data.billed.length === 0 && <p className="text-sm text-text-secondary">No billed items in this range.</p>}
              </div>
              <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-border">
                <span>Total Billed</span>
                <span>KSh {data.billedTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-3">Cash Collected by Method</h3>
              <div className="space-y-2">
                {data.collected.map((c) => (
                  <div key={c.method} className="flex justify-between text-sm">
                    <span className="text-text-secondary">{c.method}</span>
                    <span className="font-medium">KSh {c.total.toLocaleString()}</span>
                  </div>
                ))}
                {data.collected.length === 0 && <p className="text-sm text-text-secondary">No payments in this range.</p>}
              </div>
              <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-border">
                <span>Total Collected</span>
                <span>KSh {data.collectedTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-3">Expenses by Category</h3>
              <div className="space-y-2">
                {data.expensesBreakdown.map((e) => (
                  <div key={e.category} className="flex justify-between text-sm">
                    <span className="text-text-secondary">{e.category}</span>
                    <span className="font-medium text-danger">KSh {e.total.toLocaleString()}</span>
                  </div>
                ))}
                {data.expensesBreakdown.length === 0 && <p className="text-sm text-text-secondary">No approved expenses in this range.</p>}
              </div>
              <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-border">
                <span>Total Expenses</span>
                <span>KSh {data.expensesTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}