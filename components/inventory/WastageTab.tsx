"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { InventoryItemRow } from "./InventoryClient";
import { formatDisplayDate } from "@/lib/dates";

type WastageRow = {
  id: string;
  itemName: string;
  unit: string;
  quantity: number;
  reason: string;
  department: string | null;
  accountableName: string;
  recordedByName: string;
  createdAt: string;
  value: number;
};

type StaffOption = {
  id: string;
  name: string;
  role: string;
  department?: string | null;
  isActive?: boolean;
};

const MANUAL_ACCOUNTABILITY = "__manual__";
const REASONS = ["SPOILAGE", "EXPIRED", "BURNT", "DAMAGED", "PREP_WASTE", "OTHER"];
const REASON_LABEL: Record<string, string> = {
  SPOILAGE: "Spoilage",
  EXPIRED: "Expired",
  BURNT: "Burnt",
  DAMAGED: "Damaged",
  PREP_WASTE: "Preparation Waste",
  OTHER: "Other",
};

export default function WastageTab({
  inventoryItems,
  onChange,
}: {
  inventoryItems: InventoryItemRow[];
  onChange: () => void;
}) {
  const [rows, setRows] = useState<WastageRow[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function load() {
    fetch("/api/wastage")
      .then((r) => r.json())
      .then(setRows);
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus size={16} /> Record Wastage
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Quantity</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Accountable Person</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((w) => (
              <tr key={w.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-secondary">{formatDisplayDate(w.createdAt)}</td>
                <td className="px-4 py-3 font-medium">{w.itemName}</td>
                <td className="px-4 py-3">
                  {w.quantity.toLocaleString()} {w.unit}
                </td>
                <td className="px-4 py-3">{REASON_LABEL[w.reason] ?? w.reason}</td>
                <td className="px-4 py-3 text-text-secondary">{w.department || "—"}</td>
                <td className="px-4 py-3 font-medium">{w.accountableName}</td>
                <td className="px-4 py-3 text-danger">KSh {w.value.toLocaleString()}</td>
                <td className="px-4 py-3 text-text-secondary">{w.recordedByName}</td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  No wastage recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <RecordWastageModal
          inventoryItems={inventoryItems}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
            onChange();
          }}
        />
      )}
    </div>
  );
}

function RecordWastageModal({
  inventoryItems,
  onClose,
  onSaved,
}: {
  inventoryItems: InventoryItemRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [department, setDepartment] = useState("");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [accountableSelection, setAccountableSelection] = useState("");
  const [manualAccountableName, setManualAccountableName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const item = inventoryItems.find((i) => i.id === inventoryItemId);

  useEffect(() => {
    fetch("/api/staff")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the staff list.");
        return response.json();
      })
      .then((staffRows: StaffOption[]) => {
        setStaff(staffRows.filter((person) => person.isActive !== false));
      })
      .catch((staffLoadError) => {
        setStaffError(staffLoadError.message);
        setAccountableSelection(MANUAL_ACCOUNTABILITY);
      })
      .finally(() => setStaffLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/wastage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryItemId,
        quantity: Number(quantity),
        reason,
        department: department || undefined,
        accountableUserId:
          accountableSelection && accountableSelection !== MANUAL_ACCOUNTABILITY
            ? accountableSelection
            : undefined,
        accountableName:
          accountableSelection === MANUAL_ACCOUNTABILITY
            ? manualAccountableName
            : undefined,
      }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not record the wastage.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>Record Wastage</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary">Item</label>
            <select value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm">
              <option value="">Select item...</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Quantity {item ? `(${item.unit})` : ""}</label>
            <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-control border border-border px-3 py-2 text-sm">
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Person accountable</label>
            <select
              value={accountableSelection}
              onChange={(e) => setAccountableSelection(e.target.value)}
              required
              disabled={staffLoading}
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            >
              <option value="">
                {staffLoading ? "Loading staff..." : "Select staff member..."}
              </option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} — {person.department || person.role.replaceAll("_", " ")}
                </option>
              ))}
              <option value={MANUAL_ACCOUNTABILITY}>Enter a name manually...</option>
            </select>
            <p className="text-xs text-text-muted mt-1">
              This is the person responsible for the loss, not necessarily the person recording it.
            </p>
            {staffError && (
              <p className="text-xs text-warning mt-1">
                {staffError} Enter the person&apos;s name manually instead.
              </p>
            )}
          </div>
          {accountableSelection === MANUAL_ACCOUNTABILITY && (
            <div>
              <label className="text-xs text-text-secondary">Accountable person&apos;s name</label>
              <input
                value={manualAccountableName}
                onChange={(e) => setManualAccountableName(e.target.value)}
                required
                maxLength={120}
                className="w-full rounded-control border border-border px-3 py-2 text-sm"
                placeholder="e.g. Peter — Kitchen Chef"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-text-secondary">Department (optional)</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              maxLength={100}
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
              placeholder="e.g. Kitchen"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Record Wastage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}