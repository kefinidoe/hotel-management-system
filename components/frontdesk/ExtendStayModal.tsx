"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { addDays, isoDay } from "@/lib/dates";
import { roundMoney, stayNights } from "@/lib/billing";
import { formatDisplayDate } from "@/lib/dates";

type ExtendableStay = {
  id: string;
  code: string;
  guestName: string;
  roomNumbers: string;
  checkOutDate: string;
  requiredAmount: number;
  paidAmount: number;
  nightlyRateTotal: number;
};

function money(value: number) {
  return `KSh ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ExtendStayModal({
  reservation,
  onClose,
  onExtended,
}: {
  reservation: ExtendableStay;
  onClose: () => void;
  onExtended: (folioId: string) => void;
}) {
  const currentCheckOut = new Date(reservation.checkOutDate);
  const firstExtensionDate = addDays(currentCheckOut, 1);
  const [newCheckOutDate, setNewCheckOutDate] = useState(isoDay(firstExtensionDate));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  let additionalNights = 0;
  try {
    additionalNights = stayNights(currentCheckOut, new Date(newCheckOutDate));
  } catch {
    additionalNights = 0;
  }

  const additionalCharge = roundMoney(additionalNights * reservation.nightlyRateTotal);
  const newRequired = roundMoney(reservation.requiredAmount + additionalCharge);
  const newBalance = roundMoney(newRequired - reservation.paidAmount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (additionalNights < 1) {
      setError("Choose a date after the current check-out date.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkOutDate: new Date(newCheckOutDate).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not extend the stay.");
      onExtended(data.folioId);
      onClose();
    } catch (extensionError) {
      setError(
        extensionError instanceof Error ? extensionError.message : "Could not extend the stay."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2>Add Days</h2>
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
          <div>
            <label className="block text-sm font-medium mb-1.5">New check-out date</label>
            <input
              type="date"
              min={isoDay(firstExtensionDate)}
              value={newCheckOutDate}
              onChange={(event) => setNewCheckOutDate(event.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
            <p className="text-xs text-text-muted mt-1">
              Current check-out: {formatDisplayDate(currentCheckOut)}
            </p>
          </div>

          <div className="rounded-control border border-border bg-bg px-3 py-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">Original agreed nightly rate</span>
              <span>{money(reservation.nightlyRateTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Additional nights</span>
              <span>{additionalNights}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Additional charge</span>
              <span className="font-medium">{money(additionalCharge)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-text-secondary">New amount required</span>
              <span className="font-medium">{money(newRequired)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Amount already paid</span>
              <span className="text-success">{money(reservation.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>New balance due</span>
              <span className={newBalance > 0 ? "text-danger" : "text-success"}>
                {money(Math.max(0, newBalance))}
              </span>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            The extension charge will be added to the guest folio. You can collect the additional
            payment immediately after saving.
          </p>

          {error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || additionalNights < 1}
              className="btn-primary"
            >
              {loading
                ? "Saving..."
                : `Add ${additionalNights} Night${additionalNights === 1 ? "" : "s"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
