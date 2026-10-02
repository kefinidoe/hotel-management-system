"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatQty } from "@/lib/inventory";
import type { InventoryItemRow } from "./InventoryClient";
import CreateRecipeModal from "./CreateRecipeModal";

type Recipe = {
  id: string;
  menuItemId: string;
  name: string;
  category: string;
  sellingPrice: number;
  portionsPerBatch: number;
  costPerPortion: number;
  profit: number;
  profitMargin: number;
  availablePortions: number;
  limitingItem: string | null;
  ingredients: { inventoryItemId: string; name: string; unit: string; quantityPerBatch: number }[];
};

export default function RecipesTab({ inventoryItems }: { inventoryItems: InventoryItemRow[] }) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(setRecipes);
  }

  useEffect(load, []);

  async function deleteRecipe(id: string, name: string) {
    if (!confirm(`Delete the recipe for "${name}"? This only removes the ingredient list -- past sales and stock history are untouched.`)) {
      return;
    }
    const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not delete this recipe.");
      return;
    }
    setRecipes((prev) => prev?.filter((r) => r.id !== id) ?? null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          Every menu item’s ingredient list. Available portions are calculated live from current stock.
        </p>
        <button onClick={() => setCreateOpen(true)} className="btn-primary shrink-0">
          <Plus size={16} /> Create Recipe
        </button>
      </div>

      {!recipes && <p className="text-sm text-text-secondary">Loading recipes...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes?.map((r) => {
          const status =
            r.availablePortions === 0 ? "Unavailable" : r.availablePortions <= 3 ? "Limited Availability" : "Available";
          const dotClass =
            r.availablePortions === 0 ? "bg-danger" : r.availablePortions <= 3 ? "bg-warning" : "bg-success";

          return (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-text-muted">{r.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                    {status}
                  </span>
                  <button
                    onClick={() => deleteRecipe(r.id, r.name)}
                    className="text-text-muted hover:text-danger"
                    title="Delete recipe"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div>
                  <p className="text-xs text-text-muted">Sell Price</p>
                  <p className="text-sm font-semibold mt-0.5">KSh {r.sellingPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Cost</p>
                  <p className="text-sm font-semibold mt-0.5">KSh {r.costPerPortion.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Profit</p>
                  <p className="text-sm font-semibold mt-0.5 text-success">KSh {r.profit.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium">{r.availablePortions} portions available</p>
                <div className="w-full h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${dotClass}`}
                    style={{ width: `${r.availablePortions === 0 ? 0 : 100}%` }}
                  />
                </div>
                {r.limitingItem && r.availablePortions > 0 && (
                  <p className="text-xs text-text-muted mt-1">Limited by: {r.limitingItem}</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border space-y-1">
                {r.ingredients.map((ing) => (
                  <div key={ing.inventoryItemId} className="flex justify-between text-xs text-text-secondary">
                    <span>{ing.name}</span>
                    <span>
                      {formatQty(ing.quantityPerBatch, ing.unit)} / {r.portionsPerBatch} portion
                      {r.portionsPerBatch > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {recipes && recipes.length === 0 && (
          <p className="text-sm text-text-secondary col-span-full">
            No recipes yet — create one to link a menu item to its ingredients.
          </p>
        )}
      </div>

      {createOpen && (
        <CreateRecipeModal
          inventoryItems={inventoryItems}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}