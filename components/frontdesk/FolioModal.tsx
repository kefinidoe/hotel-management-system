"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type FolioDetail = {
  id: string;
  guestName: string;
  isClosed: boolean;
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; amount: number; method: string; reference: string | null }[];
  total: number;
  paid: number;
  balance: number;
};

type PaymentMethod = { id: string; name: string };

export default function FolioModal({
  folioId,
  reservationId,
  canCheckout,
  onClose,
  onDone,
}: {
  folioId: string;
  reservationId: string;
  canCheckout: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [folio, setFolio] = useState<FolioDetail | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadFolio() {
    const res = await fetch(`/api/folios/${folioId}`);
    setFolio(await res.json());
  }

  useEffect(() => {
    loadFolio();
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((m) => {
        setMethods(m);
        if (m[0]) setMethodId(m[0].id);
      });
  }, [folioId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function collectPayment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folioId, paymentMethodId: methodId, amount: Number(amount), reference }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not record payment.");
      return;
    }
    setAmount("");
    setReference("");
    loadFolio();
  }

  async function completeCheckout() {
    if (folio && folio.balance > 0) {
      if (!confirm(`This guest still owes KSh ${folio.balance.toLocaleString()}. Check out anyway?`)) return;
    }
    setLoading(true);
    const res = await fetch("/api/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not complete checkout.");
      return;
    }
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>{folio?.guestName ?? "Folio"}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {!folio && <p className="text-sm text-text-secondary">Loading...</p>}

        {folio && (
          <div className="space-y-4">
            <div className="border border-border rounded-control divide-y divide-border">
              {folio.items.map((i) => (
                <div key={i.id} className="flex justify-between px-3 py-2 text-sm">
                  <span>{i.description}</span>
                  <span className="font-medium">KSh {i.total.toLocaleString()}</span>
                </div>
              ))}
              {folio.items.length === 0 && (
                <p className="px-3 py-2 text-sm text-text-secondary">No charges yet.</p>
              )}
            </div>

            <div className="border border-border rounded-control px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-text-secondary">Total</span>
                <span>KSh {folio.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Paid</span>
                <span>KSh {folio.paid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-border">
                <span>Balance</span>
                <span className={folio.balance > 0 ? "text-danger" : "text-success"}>
                  KSh {folio.balance.toLocaleString()}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
                {error}
              </p>
            )}

            {!folio.isClosed && (
              <form onSubmit={collectPayment} className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium">Collect Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={methodId}
                    onChange={(e) => setMethodId(e.target.value)}
                    className="rounded-control border border-border px-3 py-2 text-sm"
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount (KSh)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="rounded-control border border-border px-3 py-2 text-sm"
                  />
                </div>
                <input
                  placeholder="Reference (e.g. M-Pesa code) — optional"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm"
                />
                <button type="submit" disabled={loading} className="btn-secondary w-full">
                  {loading ? "Recording..." : "Record Payment"}
                </button>
              </form>
            )}

            {!folio.isClosed && canCheckout && (
              <button onClick={completeCheckout} disabled={loading} className="btn-primary w-full">
                {loading ? "Processing..." : "Complete Checkout"}
              </button>
            )}
            {folio.isClosed && (
              <p className="text-sm text-text-secondary text-center">This folio is closed.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
