"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { addDays, isoDay } from "@/lib/dates";

type Room = { id: string; number: string; roomTypeName: string; baseRate: number };
type PaymentMethod = { id: string; name: string };

function inputClass() {
  return "w-full rounded-control border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
}

export default function CreateReservationModal({
  rooms,
  defaultRoomId,
  defaultDate,
  onClose,
  onCreated,
  onError,
}: {
  rooms: Room[];
  defaultRoomId: string;
  defaultDate: Date;
  onClose: () => void;
  onCreated: (reservationId: string) => void;
  onError: (e: string | null) => void;
}) {
  const room = rooms.find((r) => r.id === defaultRoomId);

  // Matches Axis Hotel's paper check-in card: guest identity + registration,
  // stay dates, room/tariff, and payment mode — all captured up front.
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [checkInDate, setCheckInDate] = useState(isoDay(defaultDate));
  const [checkOutDate, setCheckOutDate] = useState(isoDay(addDays(defaultDate, 1)));
  const [rate, setRate] = useState(String(room?.baseRate ?? ""));
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [paymentMode, setPaymentMode] = useState("");
  const [discount, setDiscount] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((m) => setMethods(m));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName,
        guestPhone,
        idNumber,
        nationality,
        vehicleRegistration,
        checkInDate: new Date(checkInDate).toISOString(),
        checkOutDate: new Date(checkOutDate).toISOString(),
        roomId,
        rate: Number(rate),
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        paymentMode: paymentMode || null,
        discount: discount ? Number(discount) : null,
      }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || "Could not create reservation.");
      return;
    }
    onCreated(data.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>New Reservation</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Guest</p>
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required className={inputClass()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">National ID No.</label>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className={inputClass()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nationality</label>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Vehicle Reg. (optional)</label>
              <input value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} className={inputClass()} />
            </div>
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-text-muted pt-2">Stay</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Check-in</label>
              <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} required className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Check-out</label>
              <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required className={inputClass()} />
            </div>
          </div>
          <p className="text-xs text-text-muted">Check-out is strictly at 10:00 AM.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Adults</label>
              <input type="number" min="1" value={adults} onChange={(e) => setAdults(e.target.value)} className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Children</label>
              <input type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} className={inputClass()} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Room / Tariff</label>
            <select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                const r = rooms.find((rr) => rr.id === e.target.value);
                if (r) setRate(String(r.baseRate));
              }}
              className={inputClass()}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} — {r.roomTypeName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Rate per night (KSh)</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} required className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Discount (KSh, optional)</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass()} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Payment Mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={inputClass()}>
              <option value="">Not specified</option>
              {methods.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? "Creating..." : "Create Reservation"}
          </button>
        </form>
      </div>
    </div>
  );
}
