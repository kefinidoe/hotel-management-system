"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingCart, UtensilsCrossed, Settings2, X } from "lucide-react";
import clsx from "clsx";

type MenuItem = { id: string; name: string; price: number; availablePortions: number | null };
type Category = { id: string; name: string; items: MenuItem[] };
type OrderLine = { menuItemId: string; name: string; unitPrice: number; quantity: number };
type PaymentMethod = { id: string; name: string };
type OpenFolio = { id: string; label: string };
type ActivityItem = {
  id: string;
  description: string;
  total: number;
  guestName: string;
  roomNumber: string | null;
  settled: boolean;
  createdAt: string;
};

const money = (n: number) => `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function inputClass() {
  return "w-full rounded-control border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
}

export default function RestaurantClient({ menu }: { menu: Category[] }) {
  const [activeCategory, setActiveCategory] = useState(menu[0]?.id ?? "");
  const [order, setOrder] = useState<OrderLine[]>([]);
  const [vatRate, setVatRate] = useState("0");
  const [mode, setMode] = useState<"ROOM" | "PAY">("ROOM");
  const [tableNumber, setTableNumber] = useState("");

  const [folios, setFolios] = useState<OpenFolio[]>([]);
  const [folioId, setFolioId] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [reference, setReference] = useState("");

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    const res = await fetch("/api/restaurant/activity");
    const data = await res.json();
    setActivity(data.items ?? []);
    setTodayTotal(data.todayTotal ?? 0);
  }, []);

  const loadFolios = useCallback(async () => {
    const res = await fetch("/api/restaurant/open-folios");
    const data: OpenFolio[] = await res.json();
    setFolios(data);
    setFolioId((current) => current || data[0]?.id || "");
  }, []);

  useEffect(() => {
    loadActivity();
    loadFolios();
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((m: PaymentMethod[]) => {
        setMethods(m);
        setMethodId((c) => c || m[0]?.id || "");
      });
  }, [loadActivity, loadFolios]);

  const subtotal = order.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const vat = Number(vatRate) || 0;
  const total = subtotal * (1 + vat / 100);

  function addItem(item: MenuItem) {
    setSuccess(null);
    setError(null);
    setOrder((prev) => {
      const found = prev.find((l) => l.menuItemId === item.id);
      if (found) {
        return prev.map((l) =>
          l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1 }];
    });
  }

  function changeQty(menuItemId: string, delta: number) {
    setOrder((prev) =>
      prev
        .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function clearOrder() {
    setOrder([]);
    setTableNumber("");
    setReference("");
    setCustomerName("");
  }

  async function submit() {
    if (order.length === 0) {
      setError("Add at least one item to the order.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const endpoint =
      mode === "ROOM" ? "/api/restaurant/charge-to-room" : "/api/restaurant/pay-now";
    const payload =
      mode === "ROOM"
        ? { items: order, folioId, tableNumber, vatRate: vat }
        : { items: order, paymentMethodId: methodId, customerName, reference, tableNumber, vatRate: vat };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not complete the order.");
      return;
    }

    setSuccess(
      mode === "ROOM"
        ? `${money(data.total)} charged to ${data.guestName}'s folio.`
        : `${money(data.total)} received from ${data.guestName} via ${data.method}.`
    );
    clearOrder();
    loadActivity();
    loadFolios();
  }

  const items = menu.find((c) => c.id === activeCategory)?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1>Restaurant POS</h1>
          <p className="text-text-secondary text-sm mt-1">
            {money(todayTotal)} sold today. Build an order, then charge it to a room or take
            payment at the counter.
          </p>
        </div>
        <button onClick={() => setManageOpen(true)} className="btn-secondary">
          <Settings2 size={16} /> Manage Menu
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {menu.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium border transition-colors",
                  activeCategory === c.id
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-surface border-border text-text-secondary hover:border-primary-300"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {items.map((item) => {
              const soldOut = item.availablePortions !== null && item.availablePortions <= 0;
              return (
                <button
                  key={item.id}
                  onClick={() => !soldOut && addItem(item)}
                  disabled={soldOut}
                  className={clsx(
                    "card text-left transition-colors",
                    soldOut
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:border-primary-300"
                  )}
                >
                  <p className="font-semibold leading-snug">{item.name}</p>
                  <p className="text-sm text-text-secondary mt-1">{money(item.price)}</p>
                  {soldOut && <p className="text-xs text-danger mt-1">Sold out</p>}
                </button>
              );
            })}
            {items.length === 0 && (
              <p className="text-sm text-text-secondary col-span-full">
                No items in this category yet — add some under Manage Menu.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="flex items-center gap-2 mb-3">
              <ShoppingCart size={18} strokeWidth={1.8} /> Order
            </h2>

            {order.length === 0 && (
              <p className="text-sm text-text-secondary">Tap menu items to start an order.</p>
            )}

            {order.length > 0 && (
              <div className="space-y-2">
                {order.map((l) => (
                  <div key={l.menuItemId} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{l.name}</p>
                      <p className="text-xs text-text-secondary">{money(l.unitPrice)} each</p>
                    </div>
                    <button
                      onClick={() => changeQty(l.menuItemId, -1)}
                      className="rounded-control border border-border p-1 hover:bg-bg"
                      aria-label={`Reduce ${l.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center font-medium">{l.quantity}</span>
                    <button
                      onClick={() => changeQty(l.menuItemId, 1)}
                      className="rounded-control border border-border p-1 hover:bg-bg"
                      aria-label={`Add another ${l.name}`}
                    >
                      <Plus size={14} />
                    </button>
                    <span className="w-20 text-right font-medium">
                      {money(l.unitPrice * l.quantity)}
                    </span>
                  </div>
                ))}
                <button
                  onClick={clearOrder}
                  className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-danger pt-1"
                >
                  <Trash2 size={13} /> Clear order
                </button>
              </div>
            )}

            <div className="border-t border-border mt-4 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">VAT %</span>
                <input
                  type="number"
                  min="0"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-24 rounded-control border border-border px-2 py-1 text-sm text-right"
                />
              </div>
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setMode("ROOM")}
                className={clsx(
                  "rounded-control px-3 py-2.5 text-sm font-medium border transition-colors",
                  mode === "ROOM"
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-surface border-border text-text-secondary hover:border-primary-300"
                )}
              >
                Charge to Room
              </button>
              <button
                onClick={() => setMode("PAY")}
                className={clsx(
                  "rounded-control px-3 py-2.5 text-sm font-medium border transition-colors",
                  mode === "PAY"
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-surface border-border text-text-secondary hover:border-primary-300"
                )}
              >
                Pay Now
              </button>
            </div>

            <label className="block text-sm font-medium mb-1.5">Table / note (optional)</label>
            <input
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 4"
              className={inputClass()}
            />

            {mode === "ROOM" ? (
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1.5">Charge to</label>
                <select
                  value={folioId}
                  onChange={(e) => setFolioId(e.target.value)}
                  className={inputClass()}
                >
                  {folios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                  {folios.length === 0 && <option value="">No in-house guests</option>}
                </select>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Payment method</label>
                  <select
                    value={methodId}
                    onChange={(e) => setMethodId(e.target.value)}
                    className={inputClass()}
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Customer name (optional)
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Reference (e.g. M-Pesa code)
                  </label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className={inputClass()}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mt-3">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-success bg-success/5 border border-success/20 rounded-control px-3 py-2 mt-3">
                {success}
              </p>
            )}

            <button
              onClick={submit}
              disabled={loading || order.length === 0 || (mode === "ROOM" && !folioId)}
              className="btn-primary w-full mt-4"
            >
              {loading
                ? "Processing..."
                : mode === "ROOM"
                ? `Post to Room · ${money(total)}`
                : `Take Payment · ${money(total)}`}
            </button>

            <p className="text-xs text-text-secondary mt-3">
              Charging to a room adds the items to the guest folio as Restaurant charges. Paying
              now records the sale immediately so it counts toward today&apos;s revenue.
            </p>
          </div>

          <div className="card">
            <h2 className="flex items-center gap-2 mb-3 text-base">
              <UtensilsCrossed size={17} strokeWidth={1.8} /> Recent Restaurant Activity
            </h2>
            <div className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.description}</p>
                    <p className="text-xs text-text-secondary">
                      {a.roomNumber ? `Room ${a.roomNumber} · ` : ""}
                      {a.guestName}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(a.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{money(a.total)}</p>
                    <p className={clsx("text-xs", a.settled ? "text-success" : "text-champagne-500")}>
                      {a.settled ? "Paid" : "On folio"}
                    </p>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="text-sm text-text-secondary">No restaurant orders yet today.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {manageOpen && <ManageMenuModal menu={menu} onClose={() => setManageOpen(false)} />}
    </div>
  );
}

function ManageMenuModal({ menu, onClose }: { menu: Category[]; onClose: () => void }) {
  const [categoryId, setCategoryId] = useState(menu[0]?.id ?? "");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: itemName, price: Number(itemPrice), categoryId }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr((await res.json()).error || "Could not add item.");
      return;
    }
    setItemName("");
    setItemPrice("");
    setMsg("Item added. Refresh the page to see it on the POS.");
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategory }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr((await res.json()).error || "Could not add category.");
      return;
    }
    setNewCategory("");
    setMsg("Category added. Refresh the page to see it.");
  }

  async function removeItem(id: string) {
    if (!confirm("Remove this item from the menu?")) return;
    const res = await fetch(`/api/menu/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setErr("Could not remove item.");
      return;
    }
    setMsg("Item removed. Refresh the page to update the POS.");
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>Manage Menu</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {err && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">
            {err}
          </p>
        )}
        {msg && (
          <p className="text-sm text-success bg-success/5 border border-success/20 rounded-control px-3 py-2 mb-3">
            {msg}
          </p>
        )}

        <form onSubmit={addItem} className="space-y-3">
          <p className="text-sm font-medium">Add a menu item</p>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass()}>
            {menu.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Item name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
            className={inputClass()}
          />
          <input
            type="number"
            placeholder="Price (KSh)"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            required
            className={inputClass()}
          />
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Saving..." : "Add Item"}
          </button>
        </form>

        <form onSubmit={addCategory} className="space-y-3 border-t border-border pt-4 mt-4">
          <p className="text-sm font-medium">Add a category</p>
          <input
            placeholder="e.g. Desserts"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            required
            className={inputClass()}
          />
          <button type="submit" disabled={loading} className="btn-secondary w-full">
            Add Category
          </button>
        </form>

        <div className="border-t border-border pt-4 mt-4 space-y-3">
          <p className="text-sm font-medium">Current items</p>
          {menu.map((c) => (
            <div key={c.id}>
              <p className="text-xs uppercase tracking-wide text-text-muted mb-1">{c.name}</p>
              <div className="space-y-1">
                {c.items.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between border border-border rounded-control px-3 py-1.5 text-sm"
                  >
                    <span>
                      {i.name} — {money(i.price)}
                    </span>
                    <button onClick={() => removeItem(i.id)} className="text-text-secondary hover:text-danger">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {c.items.length === 0 && <p className="text-xs text-text-muted">No items.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}