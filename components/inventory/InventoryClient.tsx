"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShoppingBag, X } from "lucide-react";
import clsx from "clsx";

type Item = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  unitCost: number | null;
};
type PendingOrder = {
  id: string;
  itemName: string;
  unit: string;
  supplier: string | null;
  quantity: number;
  orderedAt: string;
};

function inputClass() {
  return "w-full rounded-control border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function InventoryClient({
  initialItems,
  pendingOrders,
}: {
  initialItems: Item[];
  pendingOrders: PendingOrder[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  function refresh() {
    router.refresh();
  }

  const totalItems = initialItems.length;
  const lowStock = initialItems.filter((i) => i.currentStock <= i.reorderLevel);
  const stockValue = initialItems.reduce((s, i) => s + i.currentStock * (i.unitCost ?? 0), 0);

  const kpis = [
    { label: "Total Items", value: String(totalItems) },
    { label: "Low Stock", value: String(lowStock.length) },
    { label: "Stock Value", value: money(stockValue) },
    { label: "Pending Purchases", value: String(pendingOrders.length) },
  ];

  async function receiveOrder(id: string) {
    setError(null);
    const res = await fetch(`/api/purchase-orders/${id}/receive`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not receive this order.");
      return;
    }
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Inventory</h1>
          <p className="text-text-secondary text-sm mt-1">Stock levels across the hotel.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPoOpen(true)} className="btn-secondary">
            <ShoppingBag size={16} /> New Purchase Order
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus size={16} /> Receive Stock
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <p className="text-sm text-text-secondary">{k.label}</p>
            <p className="kpi-value mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted text-xs uppercase border-b border-border">
              <th className="p-3 font-medium">SKU</th>
              <th className="p-3 font-medium">Item</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Stock</th>
              <th className="p-3 font-medium">Unit</th>
              <th className="p-3 font-medium">Reorder Level</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {initialItems.map((i) => {
              const low = i.currentStock <= i.reorderLevel;
              return (
                <tr
                  key={i.id}
                  onClick={() => setSelected(i)}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-primary-50/40"
                >
                  <td className="p-3 text-text-secondary">{i.sku}</td>
                  <td className="p-3 font-medium">{i.name}</td>
                  <td className="p-3 text-text-secondary">{i.category}</td>
                  <td className="p-3">{i.currentStock}</td>
                  <td className="p-3 text-text-secondary">{i.unit}</td>
                  <td className="p-3 text-text-secondary">{i.reorderLevel}</td>
                  <td className="p-3">
                    <span className={clsx("badge", low ? "bg-danger/10 text-danger" : "bg-primary-50 text-primary-700")}>
                      {low ? "Low Stock" : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {initialItems.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-text-secondary">
                  No inventory items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3">Pending Purchase Orders ({pendingOrders.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pendingOrders.map((o) => (
          <div key={o.id} className="card">
            <p className="font-medium">
              {o.quantity} {o.unit} — {o.itemName}
            </p>
            <p className="text-sm text-text-secondary">{o.supplier || "No supplier noted"}</p>
            <p className="text-xs text-text-muted mt-1">
              Ordered {new Date(o.orderedAt).toLocaleDateString()}
            </p>
            <button onClick={() => receiveOrder(o.id)} className="btn-primary w-full mt-3">
              Mark Received
            </button>
          </div>
        ))}
        {pendingOrders.length === 0 && (
          <p className="text-sm text-text-secondary">No pending purchase orders.</p>
        )}
      </div>

      {addOpen && (
        <StockItemsModal
          items={initialItems}
          onClose={() => setAddOpen(false)}
          onDone={refresh}
          onError={setError}
        />
      )}

      {poOpen && (
        <NewPurchaseOrderModal
          items={initialItems}
          onClose={() => setPoOpen(false)}
          onDone={refresh}
          onError={setError}
        />
      )}

      {selected && (
        <ItemActionsModal
          item={selected}
          onClose={() => setSelected(null)}
          onDone={refresh}
          onError={setError}
        />
      )}
    </div>
  );
}

/** Combined entry point: add a brand-new item, or receive/issue/adjust an existing one. */
function StockItemsModal({
  items,
  onClose,
  onDone,
  onError,
}: {
  items: Item[];
  onClose: () => void;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [openingStock, setOpeningStock] = useState("0");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        name,
        category,
        unit,
        reorderLevel: Number(reorderLevel) || 0,
        unitCost: unitCost ? Number(unitCost) : null,
        openingStock: Number(openingStock) || 0,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      onError((await res.json()).error || "Could not add item.");
      return;
    }
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>Add Inventory Item</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} required className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} required className={inputClass()} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Item Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Unit (e.g. pcs, kg)</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} required className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reorder Level</label>
              <input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className={inputClass()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Opening Stock</label>
              <input type="number" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Unit Cost (KSh, optional)</label>
              <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inputClass()} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? "Adding..." : "Add Item"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NewPurchaseOrderModal({
  items,
  onClose,
  onDone,
  onError,
}: {
  items: Item[];
  onClose: () => void;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [supplier, setSupplier] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        supplier,
        quantity: Number(quantity),
        unitCost: unitCost ? Number(unitCost) : null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      onError((await res.json()).error || "Could not create purchase order.");
      return;
    }
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>New Purchase Order</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Item</label>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass()}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Supplier (optional)</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputClass()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Quantity</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Unit Cost (optional)</label>
              <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inputClass()} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? "Creating..." : "Create Purchase Order"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ItemActionsModal({
  item,
  onClose,
  onDone,
  onError,
}: {
  item: Item;
  onClose: () => void;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [tab, setTab] = useState<"RECEIVE" | "ISSUE" | "ADJUST">("RECEIVE");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);

    const endpoint =
      tab === "RECEIVE"
        ? `/api/inventory/${item.id}/receive`
        : tab === "ISSUE"
        ? `/api/inventory/${item.id}/issue`
        : `/api/inventory/${item.id}/adjust`;

    const body =
      tab === "ADJUST"
        ? { newQuantity: Number(quantity), reason: note }
        : { quantity: Number(quantity), note };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      onError((await res.json()).error || "Could not update stock.");
      return;
    }
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>{item.name}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Current stock: {item.currentStock} {item.unit}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["RECEIVE", "ISSUE", "ADJUST"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "rounded-control px-3 py-2 text-sm font-medium border transition-colors",
                tab === t
                  ? "bg-primary-50 border-primary-300 text-primary-700"
                  : "bg-surface border-border text-text-secondary"
              )}
            >
              {t === "RECEIVE" ? "Receive" : t === "ISSUE" ? "Issue" : "Adjust"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {tab === "ADJUST" ? "Counted quantity" : "Quantity"}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {tab === "ADJUST" ? "Reason (required)" : "Note (optional)"}
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} required={tab === "ADJUST"} className={inputClass()} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Saving..." : tab === "RECEIVE" ? "Receive Stock" : tab === "ISSUE" ? "Issue Stock" : "Save Adjustment"}
          </button>
        </form>
      </div>
    </div>
  );
}
