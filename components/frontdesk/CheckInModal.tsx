"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { roundMoney } from "@/lib/billing";

type PaymentMethod = { id: string; name: string };

type CheckInReservation = {
  id: string;
  code: string;
  guestName: string;
  roomNumbers: string;
  requiredAmount: number;
};

function money(value: number) {
  return `KSh ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CheckInModal({
  reservation,
  onClose,
  onCheckedIn,
}: {
  reservation: CheckInReservation;
  onClose: () => void;
  onCheckedIn: (folioId: string) => void;
}) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amountPaid, setAmountPaid] = useState(String(reservation.requiredAmount));
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMethods() {
      try {
        const response = await fetch("/api/payment-methods");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load payment methods.");
        if (!cancelled) {
          setMethods(data);
          setMethodId(data[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load payment methods."
          );
        }
      } finally {
        if (!cancelled) setLoadingMethods(false);
      }
    }

    loadMethods();
    return () => {
      cancelled = true;
    };
  }, []);

  const numericPaid = Number(amountPaid);
  const previewPaid = Number.isFinite(numericPaid) && numericPaid >= 0 ? numericPaid : 0;
  const balance = roundMoney(Math.max(0, reservation.requiredAmount - previewPaid));
  const paymentRequired = previewPaid > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(numericPaid) || numericPaid < 0) {
      setError("Enter a valid amount paid.");
      return;
    }
    if (numericPaid > reservation.requiredAmount) {
      setError("Amount paid cannot exceed the required amount.");
      return;
    }
    if (numericPaid > 0 && !methodId) {
      setError("Choose a payment method.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.id,
          amountPaid: numericPaid,
          paymentMethodId: numericPaid > 0 ? methodId : null,
          reference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check in the guest.");
      onCheckedIn(data.folioId);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not check in the guest."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2>Check In Guest</h2>
            <p className="text-sm text-text-secondary mt-1">
              {reservation.guestName} · Room {reservation.roomNumbers} · {reservation.code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-control border border-border bg-bg px-3 py-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Amount required</span>
              <span className="font-medium">{money(reservation.requiredAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Amount paid at check-in</span>
              <span>{money(previewPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Balance after check-in</span>
              <span className={balance > 0 ? "text-danger" : "text-success"}>
                {money(balance)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Amount paid now (KSh)</label>
            <input
              type="number"
              min="0"
              max={reservation.requiredAmount}
              step="0.01"
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
            <p className="text-xs text-text-muted mt-1">
              Enter 0 if no payment is being collected now. The balance will remain on the folio.
            </p>
          </div>

          {paymentRequired && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Payment method</label>
                <select
                  value={methodId}
                  onChange={(event) => setMethodId(event.target.value)}
                  required
                  disabled={loadingMethods}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm"
                >
                  {methods.length === 0 && <option value="">No payment methods available</option>}
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Reference (optional)
                </label>
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="For example, M-Pesa code"
                  className="w-full rounded-control border border-border px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (paymentRequired && (loadingMethods || !methodId))}
              className="btn-primary"
            >
              {submitting ? "Checking in..." : "Confirm Check-in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
