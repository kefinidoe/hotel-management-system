"use client";

import { useMemo, useState } from "react";
import { Package, Wallet, AlertTriangle, XCircle, TrendingDown, TrendingUp, Plus, Search } from "lucide-react";
import { formatQty, STOCK_STATUS_LABEL, STOCK_STATUS_BADGE_CLASS, type StockStatus } from "@/lib/inventory";
import RecipesTab from "./RecipesTab";
import PurchasesTab from "./PurchasesTab";
import WastageTab from "./WastageTab";
import MovementsTab from "./MovementsTab";
import AddItemModal from "./AddItemModal";
import AdjustStockModal from "./AdjustStockModal";

export type InventoryItemRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  costPerUnit: number;
  supplier: string | null;
  stockValue: number;
  status: StockStatus;
};

type Kpis = {
  totalItems: number;
  totalValue: number;
  lowStock: number;
  outOfStock: number;
  todaysConsumption: number;
  todaysPurchases: number;
};

const TABS = ["Stock Overview", "Recipes", "Purchases", "Wastage", "Stock Movements"] as const;
type Tab = (typeof TABS)[number];

export default function InventoryClient({
  initialItems,
  kpis,
}: {
  initialItems: InventoryItemRow[];
  kpis: Kpis;
}) {
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<Tab>("Stock Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItemRow | null>(null);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const matchesSearch =
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.sku.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || i.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  function refreshItems() {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then(setItems);
  }

  async function deleteItem(item: InventoryItemRow) {
    if (
      !confirm(
        `Remove "${item.name}"? If it's never been purchased, wasted, adjusted, or used in a recipe, it's deleted for good. If it has any history, it's hidden instead so past records still make sense.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/inventory/${item.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Could not remove this item.");
      return;
    }
    refreshItems();
  }

  const kpiCards = [
    { label: "Total Inventory Items", value: kpis.totalItems.toLocaleString(), icon: Package },
    { label: "Total Inventory Value", value: `KSh ${kpis.totalValue.toLocaleString()}`, icon: Wallet },
    { label: "Low Stock Items", value: kpis.lowStock.toLocaleString(), icon: AlertTriangle },
    { label: "Out of Stock", value: kpis.outOfStock.toLocaleString(), icon: XCircle },
    { label: "Today's Consumption", value: kpis.todaysConsumption.toLocaleString(), icon: TrendingDown },
    { label: "Today's Purchases", value: kpis.todaysPurchases.toLocaleString(), icon: TrendingUp },
  ];

  return (
    <div>
      <h1>Inventory Management</h1>
      <p className="text-text-secondary text-sm mt-1 mb-6">
        Monitor stock, ingredient consumption, recipes, purchases and kitchen usage in real time.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="card">
            <k.icon size={18} className="text-primary-500" strokeWidth={1.8} />
            <p className="kpi-value mt-2 text-2xl">{k.value}</p>
            <p className="text-xs text-text-secondary mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-border mt-6 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary-500 text-primary-700"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Stock Overview" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items..."
                  className="w-full rounded-control border border-border pl-8 pr-3 py-2 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-control border border-border px-3 py-2 text-sm"
              >
                <option value="ALL">All statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="CRITICAL">Critical</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
            <button onClick={() => setAddOpen(true)} className="btn-primary">
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Current Stock</th>
                  <th className="px-4 py-3 font-medium">Reorder Level</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Stock Value</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-primary-50/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.name}</p>
                      <p className="text-xs text-text-muted">{i.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{i.category}</td>
                    <td className="px-4 py-3">{formatQty(i.currentStock, i.unit)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatQty(i.reorderLevel, i.unit)}</td>
                    <td className="px-4 py-3">
                      <span className={STOCK_STATUS_BADGE_CLASS[i.status]}>{STOCK_STATUS_LABEL[i.status]}</span>
                    </td>
                    <td className="px-4 py-3">KSh {i.stockValue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setAdjustItem(i)}
                        className="text-primary-600 text-xs font-medium hover:underline"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={() => deleteItem(i)}
                        className="text-danger text-xs font-medium hover:underline ml-3"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                      No items match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Recipes" && <RecipesTab inventoryItems={items} />}
      {tab === "Purchases" && <PurchasesTab inventoryItems={items} onChange={refreshItems} />}
      {tab === "Wastage" && <WastageTab inventoryItems={items} onChange={refreshItems} />}
      {tab === "Stock Movements" && <MovementsTab />}

      {addOpen && (
        <AddItemModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            refreshItems();
          }}
        />
      )}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSaved={() => {
            setAdjustItem(null);
            refreshItems();
          }}
        />
      )}
    </div>
  );
}