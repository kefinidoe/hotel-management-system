"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { InventoryItemRow } from "./InventoryClient";

type MenuItemOption = { id: string; name: string; categoryName: string };
type IngredientRow = { inventoryItemId: string; quantity: string };

export default function CreateRecipeModal({
  inventoryItems,
  onClose,
  onCreated,
}: {
  inventoryItems: InventoryItemRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [menuItemId, setMenuItemId] = useState("");
  const [portions, setPortions] = useState("1");
  const [rows, setRows] = useState<IngredientRow[]>([{ inventoryItemId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((categories: { name: string; items: { id: string; name: string }[] }[]) => {
        setMenuItems(categories.flatMap((c) => c.items.map((i) => ({ id: i.id, name: i.name, categoryName: c.name }))));
      });
  }, []);

  function updateRow(idx: number, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { inventoryItemId: "", quantity: "" }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ingredients = rows
      .filter((r) => r.inventoryItemId && r.quantity)
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity) }));
    if (!menuItemId || ingredients.length === 0) {
      setError("Pick a menu item and at least one ingredient.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId, portions: Number(portions) || 1, ingredients }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create the recipe.");
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>Create Recipe</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">{error}</p>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary">Menu Item</label>
            <select
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            >
              <option value="">Select a menu item...</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.categoryName} — {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-secondary">This ingredient list makes how many portions?</label>
            <input
              type="number"
              min="1"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-secondary">Ingredients</label>
              <button type="button" onClick={addRow} className="text-primary-600 text-xs font-medium hover:underline">
                + Add Ingredient
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, idx) => {
                const inv = inventoryItems.find((i) => i.id === row.inventoryItemId);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.inventoryItemId}
                      onChange={(e) => updateRow(idx, { inventoryItemId: e.target.value })}
                      className="flex-1 rounded-control border border-border px-2 py-2 text-sm"
                    >
                      <option value="">Ingredient...</option>
                      {inventoryItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                      placeholder={inv ? inv.unit : "qty"}
                      className="w-24 rounded-control border border-border px-2 py-2 text-sm"
                    />
                    <button type="button" onClick={() => removeRow(idx)} className="text-danger">
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-muted mt-2">
              Enter quantities in each ingredient's base unit (g, ml, or pcs).
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Create Recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}