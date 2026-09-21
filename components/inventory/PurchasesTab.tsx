"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { InventoryItemRow } from "./InventoryClient";

type Purchase = {
  id: string;
  itemName: string;
  unit: string;
  supplier: string;
  invoiceNumber: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  createdByName: string;
};

export default function PurchasesTab({
  inventoryItems,
  onChange,
}: {
  inventoryItems: InventoryItemRow[];
  onChange: () => void;
}) {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function load() {
    fetch("/api/purchases")
      .then((r) => r.json())
      .then(setPurchases);
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus size={16} /> Record Purchase
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Quantity</th>
              <th className="px-4 py-3 font-medium">Unit Cost</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {purchases?.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-secondary">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium">{p.itemName}</td>
                <td className="px-4 py-3">{p.supplier}</td>
                <td className="px-4 py-3 text-text-secondary">{p.invoiceNumber || "—"}</td>
                <td className="px-4 py-3">
                  {p.quantity.toLocaleString()} {p.unit}
                </td>
                <td className="px-4 py-3">KSh {p.unitCost.toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">KSh {p.totalCost.toLocaleString()}</td>
                <td className="px-4 py-3 text-text-secondary">{p.createdByName}</td>
              </tr>
            ))}
            {purchases?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  No purchases recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <RecordPurchaseModal
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

function RecordPurchaseModal({
  inventoryItems,
  onClose,
  onSaved,
}: {
  inventoryItems: InventoryItemRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const item = inventoryItems.find((i) => i.id === inventoryItemId);
  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryItemId,
        supplier,
        invoiceNumber: invoiceNumber || undefined,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
      }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not record the purchase.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>Record Purchase</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary">Item</label>
            <select
              value={inventoryItemId}
              onChange={(e) => setInventoryItemId(e.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            >
              <option value="">Select item...</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Supplier</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Invoice Number (optional)</label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full rounded-control border border-border px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Quantity {item ? `(${item.unit})` : ""}</label>
              <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Unit Cost (KSh)</label>
              <input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm" />
            </div>
          </div>
          {totalCost > 0 && <p className="text-sm font-medium">Total: KSh {totalCost.toLocaleString()}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Record Purchase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}