"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import CreateReservationModal from "@/components/reservations/CreateReservationModal";
import FolioModal from "./FolioModal";

type ResRow = {
  id: string;
  code: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumbers: string;
  openFolioId: string | null;
};
type Room = { id: string; number: string; roomTypeName: string; baseRate: number };

export default function FrontDeskClient({
  arrivals,
  departures,
  inHouse,
  availableRoomsCount,
  rooms,
}: {
  arrivals: ResRow[];
  departures: ResRow[];
  inHouse: ResRow[];
  availableRoomsCount: number;
  rooms: Room[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [openFolio, setOpenFolio] = useState<{ folioId: string; reservationId: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function checkIn(reservationId: string) {
    setLoadingId(reservationId);
    setError(null);
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId }),
    });
    setLoadingId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not check in guest.");
      return;
    }
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Front Desk</h1>
          <p className="text-text-secondary text-sm mt-1">
            {availableRoomsCount} rooms available today. Check-out is strictly at 10:00 AM.
          </p>
        </div>
        <button onClick={() => setWalkInOpen(true)} className="btn-primary">
          <UserPlus size={16} /> Walk-in
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section>
          <h2 className="mb-3">Arrivals ({arrivals.length})</h2>
          <div className="space-y-2">
            {arrivals.map((r) => (
              <div key={r.id} className="card">
                <p className="font-medium">{r.guestName}</p>
                <p className="text-sm text-text-secondary">Room {r.roomNumbers} · {r.code}</p>
                <button
                  onClick={() => checkIn(r.id)}
                  disabled={loadingId === r.id}
                  className="btn-primary w-full mt-3"
                >
                  {loadingId === r.id ? "Checking in..." : "Check In"}
                </button>
              </div>
            ))}
            {arrivals.length === 0 && <p className="text-sm text-text-secondary">No arrivals today.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-3">Departures ({departures.length})</h2>
          <div className="space-y-2">
            {departures.map((r) => (
              <div key={r.id} className="card">
                <p className="font-medium">{r.guestName}</p>
                <p className="text-sm text-text-secondary">Room {r.roomNumbers} · {r.code}</p>
                <button
                  onClick={() =>
                    r.openFolioId
                      ? setOpenFolio({ folioId: r.openFolioId, reservationId: r.id })
                      : setError("No open folio found for this reservation.")
                  }
                  className="btn-secondary w-full mt-3"
                >
                  View Folio / Check Out
                </button>
              </div>
            ))}
            {departures.length === 0 && <p className="text-sm text-text-secondary">No departures today.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-3">In-house Guests ({inHouse.length})</h2>
          <div className="space-y-2">
            {inHouse.map((r) => (
              <div key={r.id} className="card">
                <p className="font-medium">{r.guestName}</p>
                <p className="text-sm text-text-secondary">
                  Room {r.roomNumbers} · until {new Date(r.checkOutDate).toLocaleDateString()}
                </p>
                <button
                  onClick={() =>
                    r.openFolioId
                      ? setOpenFolio({ folioId: r.openFolioId, reservationId: r.id })
                      : setError("No open folio found for this reservation.")
                  }
                  className="btn-secondary w-full mt-3"
                >
                  View Folio
                </button>
              </div>
            ))}
            {inHouse.length === 0 && <p className="text-sm text-text-secondary">No guests currently in-house.</p>}
          </div>
        </section>
      </div>

      {walkInOpen && rooms.length > 0 && (
        <CreateReservationModal
          rooms={rooms}
          defaultRoomId={rooms[0].id}
          defaultDate={new Date()}
          onClose={() => setWalkInOpen(false)}
          onCreated={() => refresh()}
          onError={setError}
        />
      )}

      {openFolio && (
        <FolioModal
          folioId={openFolio.folioId}
          reservationId={openFolio.reservationId}
          onClose={() => setOpenFolio(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
