"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatQty } from "@/lib/inventory";
import type { InventoryItemRow } from "./InventoryClient";

export default function AdjustStockModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItemRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newQuantity, setNewQuantity] = useState(String(item.currentStock));
  const [reason, setReason] = useState("Physical stock count");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const delta = Number(newQuantity) - item.currentStock;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newQuantity: Number(newQuantity), reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not save the adjustment.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h2>Adjust Stock</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-4">{item.name}</p>

        {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary">System Stock</label>
            <p className="text-sm font-medium py-1.5">{formatQty(item.currentStock, item.unit)}</p>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Physical Count / New Quantity ({item.unit})</label>
            <input
              type="number"
              step="0.01"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>
          {delta !== 0 && (
            <p className={`text-xs ${delta > 0 ? "text-success" : "text-danger"}`}>
              Adjustment: {delta > 0 ? "+" : ""}
              {formatQty(delta, item.unit)}
            </p>
          )}
          <div>
            <label className="text-xs text-text-secondary">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Save Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}