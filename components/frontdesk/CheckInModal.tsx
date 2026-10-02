"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomStatus } from "@prisma/client";
import { X } from "lucide-react";
import { roundMoney } from "@/lib/billing";
import {
  blocksGuestPlacement,
  isBookableToday,
  notBookableReason,
  roomStatusClasses,
  roomStatusDotClasses,
  ROOM_STATUS_LABELS,
} from "@/lib/room-status";

export type SelectableRoom = {
  id: string;
  number: string;
  status: RoomStatus;
};

type PaymentMethod = { id: string; name: string };

type CheckInReservation = {
  id: string;
  code: string;
  guestName: string;
  roomId: string;
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
  rooms,
  onClose,
  onCheckedIn,
}: {
  reservation: CheckInReservation;
  rooms: SelectableRoom[];
  onClose: () => void;
  onCheckedIn: (folioId: string) => void;
}) {
  const [newRoomId, setNewRoomId] = useState("");
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

  // The room the guest is actually given: the reserved one unless the
  // receptionist moves them because it is not ready.
  const reservedRoom = rooms.find((room) => room.id === reservation.roomId) ?? null;
  const reservedRoomStatus = reservedRoom?.status ?? null;
  // "Reserved" is not a problem here: it may be reserved for this very guest.
  const reservedRoomReady = reservedRoomStatus ? !blocksGuestPlacement(reservedRoomStatus) : true;

  const otherRooms = useMemo(
    () =>
      rooms
        .filter((room) => room.id !== reservation.roomId && isBookableToday(room.status))
        .sort((left, right) => left.number.localeCompare(right.number, undefined, { numeric: true })),
    [rooms, reservation.roomId]
  );

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
          newRoomId: newRoomId || null,
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
          {reservedRoom && (
            <div className="rounded-control border border-border px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-secondary">Reserved room</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Room {reservedRoom.number}</span>
                  {reservedRoomStatus && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${roomStatusClasses(reservedRoomStatus)}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${roomStatusDotClasses(reservedRoomStatus)}`} />
                      {ROOM_STATUS_LABELS[reservedRoomStatus]}
                    </span>
                  )}
                </span>
              </div>

              {!reservedRoomReady && reservedRoomStatus && (
                <p className="mt-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-control px-2.5 py-2">
                  {notBookableReason(reservedRoomStatus)} Give the guest another room below, or ask
                  housekeeping to finish Room {reservedRoom.number} first.
                </p>
              )}

              {otherRooms.length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1.5">
                    Change room (optional)
                  </label>
                  <select
                    value={newRoomId}
                    onChange={(event) => setNewRoomId(event.target.value)}
                    className="w-full rounded-control border border-border px-3 py-2 text-sm"
                  >
                    <option value="">Keep Room {reservedRoom.number}</option>
                    {otherRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number} — {ROOM_STATUS_LABELS[room.status]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-muted mt-1">
                    Only rooms that are free and clean are listed. The nightly rate stays the same.
                  </p>
                </div>
              )}

              {otherRooms.length === 0 && !reservedRoomReady && (
                <p className="mt-2 text-xs text-danger">
                  No other room is free and clean right now. Ask housekeeping to finish Room{" "}
                  {reservedRoom.number}, then check in.
                </p>
              )}
            </div>
          )}

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
              disabled={
                submitting ||
                (paymentRequired && (loadingMethods || !methodId)) ||
                (!reservedRoomReady && !newRoomId)
              }
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
