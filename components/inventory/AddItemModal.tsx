"use client";

import { useState } from "react";
import { X } from "lucide-react";

function inputClass() {
  return "w-full rounded-control border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
}

export default function AddItemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<"g" | "ml" | "pcs">("g");
  const [currentStock, setCurrentStock] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sku = `SKU-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 20)}-${Date.now()
      .toString()
      .slice(-4)}`;
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        name,
        category,
        unit,
        currentStock: Number(currentStock) || 0,
        reorderLevel: Number(reorderLevel) || 0,
        costPerUnit: Number(costPerUnit) || 0,
        supplier: supplier || null,
      }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create the item.");
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>Add Inventory Item</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary">Item Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass()} placeholder="e.g. Maize Flour" />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} required className={inputClass()} placeholder="e.g. Dry Goods" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Base Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className={inputClass()}>
                <option value="g">g (weight)</option>
                <option value="ml">ml (liquid)</option>
                <option value="pcs">pcs (count)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary">Cost per {unit}</label>
              <input
                type="number"
                step="0.01"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className={inputClass()}
                placeholder="KSh"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Opening Stock ({unit})</label>
              <input
                type="number"
                step="0.01"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Reorder Level ({unit})</label>
              <input
                type="number"
                step="0.01"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className={inputClass()}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Supplier (optional)</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputClass()} />
          </div>

          <p className="text-xs text-text-muted">
            Tip: enter quantities in the base unit — e.g. 2 kg of Maize Flour is entered as 2000, since g is the base unit.
          </p>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}