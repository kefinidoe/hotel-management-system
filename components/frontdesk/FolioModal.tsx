"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type FolioDetail = {
  id: string;
  guestName: string;
  isClosed: boolean;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    createdAt: string;
  }[];
  required: number;
  paid: number;
  balance: number;
};

type PaymentMethod = { id: string; name: string };

function money(value: number) {
  return `KSh ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FolioModal({
  folioId,
  reservationId,
  canCheckout,
  canOverrideBalance,
  onClose,
  onDone,
}: {
  folioId: string;
  reservationId: string;
  canCheckout: boolean;
  canOverrideBalance: boolean;
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
    const response = await fetch(`/api/folios/${folioId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the folio.");
    setFolio(data);
    setAmount(data.balance > 0 ? String(data.balance) : "");
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [folioResponse, methodsResponse] = await Promise.all([
          fetch(`/api/folios/${folioId}`),
          fetch("/api/payment-methods"),
        ]);
        const [folioData, methodsData] = await Promise.all([
          folioResponse.json(),
          methodsResponse.json(),
        ]);
        if (!folioResponse.ok) {
          throw new Error(folioData.error || "Could not load the folio.");
        }
        if (!methodsResponse.ok) {
          throw new Error(methodsData.error || "Could not load payment methods.");
        }
        if (!cancelled) {
          setFolio(folioData);
          setAmount(folioData.balance > 0 ? String(folioData.balance) : "");
          setMethods(methodsData);
          setMethodId(methodsData[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the folio.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [folioId]);

  async function collectPayment(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folioId,
          paymentMethodId: methodId,
          amount: Number(amount),
          reference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record payment.");
      setReference("");
      await loadFolio();
      onDone();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error ? paymentError.message : "Could not record payment."
      );
    } finally {
      setLoading(false);
    }
  }

  async function completeCheckout() {
    if (!folio) return;

    const hasBalance = folio.balance > 0;
    if (hasBalance && !canOverrideBalance) {
      setError("The outstanding balance must be paid before checkout.");
      return;
    }
    if (
      hasBalance &&
      !confirm(
        `This guest still owes ${money(folio.balance)}. Use the Admin/Manager override and check out anyway?`
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          allowOutstandingBalance: hasBalance,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not complete checkout.");
      onDone();
      onClose();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : "Could not complete checkout."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>{folio?.guestName ?? "Folio"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {!folio && !error && <p className="text-sm text-text-secondary">Loading...</p>}

        {folio && (
          <div className="space-y-4">
            <div className="border border-border rounded-control divide-y divide-border">
              {folio.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span>{item.description}</span>
                  <span className="font-medium whitespace-nowrap">{money(item.total)}</span>
                </div>
              ))}
              {folio.items.length === 0 && (
                <p className="px-3 py-2 text-sm text-text-secondary">No charges yet.</p>
              )}
            </div>

            <div className="border border-border rounded-control px-3 py-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-text-secondary">Amount required</span>
                <span>{money(folio.required)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Amount paid</span>
                <span className="text-success">{money(folio.paid)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>{folio.balance < 0 ? "Credit" : "Balance due"}</span>
                <span className={folio.balance > 0 ? "text-danger" : "text-success"}>
                  {money(Math.abs(folio.balance))}
                </span>
              </div>
            </div>

            {folio.payments.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Payments received</p>
                <div className="border border-border rounded-control divide-y divide-border">
                  {folio.payments.map((payment) => (
                    <div key={payment.id} className="px-3 py-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span>
                          {payment.method} · {new Date(payment.createdAt).toLocaleString()}
                        </span>
                        <span className="font-medium whitespace-nowrap">
                          {money(payment.amount)}
                        </span>
                      </div>
                      {payment.reference && (
                        <p className="text-xs text-text-muted mt-1">
                          Reference: {payment.reference}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
                {error}
              </p>
            )}

            {!folio.isClosed && folio.balance > 0 && (
              <form onSubmit={collectPayment} className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium">Collect Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={methodId}
                    onChange={(event) => setMethodId(event.target.value)}
                    required
                    className="rounded-control border border-border px-3 py-2 text-sm"
                  >
                    {methods.length === 0 && <option value="">No methods available</option>}
                    {methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    max={folio.balance}
                    step="0.01"
                    placeholder="Amount (KSh)"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    className="rounded-control border border-border px-3 py-2 text-sm"
                  />
                </div>
                <input
                  placeholder="Reference (for example, M-Pesa code) — optional"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading || !methodId}
                  className="btn-secondary w-full"
                >
                  {loading ? "Recording..." : "Record Payment"}
                </button>
              </form>
            )}

            {!folio.isClosed && folio.balance <= 0 && (
              <p className="text-sm text-success bg-success/5 border border-success/20 rounded-control px-3 py-2 text-center">
                This folio is fully paid.
              </p>
            )}

            {!folio.isClosed && canCheckout && folio.balance > 0 && !canOverrideBalance && (
              <p className="text-sm text-danger text-center">
                Collect the outstanding balance before checkout. An Admin or Manager may override.
              </p>
            )}

            {!folio.isClosed &&
              canCheckout &&
              (folio.balance <= 0 || canOverrideBalance) && (
                <button
                  type="button"
                  onClick={completeCheckout}
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading
                    ? "Processing..."
                    : folio.balance > 0
                    ? "Manager Override & Check Out"
                    : "Complete Checkout"}
                </button>
              )}

            {folio.isClosed && (
              <p className="text-sm text-text-secondary text-center">This folio is closed.</p>
            )}
          </div>
        )}

        {!folio && error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
