"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

type GuestRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  currentRoom: string | null;
  lastStatus: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

type GuestDetail = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  nationality: string | null;
  vehicleRegistration: string | null;
  notes: string | null;
  reservations: {
    id: string;
    code: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    rooms: { roomNumber: string; rate: number }[];
  }[];
  folios: { id: string; isClosed: boolean; total: number; paid: number; balance: number }[];
};

export default function GuestsClient({ initialGuests }: { initialGuests: GuestRow[] }) {
  const [guests, setGuests] = useState(initialGuests);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetail | null>(null);

  async function search(q: string) {
    setQuery(q);
    const res = await fetch(`/api/guests?q=${encodeURIComponent(q)}`);
    setGuests(await res.json());
  }

  async function openGuest(id: string) {
    setSelectedId(id);
    setDetail(null);
    const res = await fetch(`/api/guests/${id}`);
    setDetail(await res.json());
  }

  return (
    <div>
      <h1>Guests</h1>
      <p className="text-text-secondary text-sm mt-1 mb-4">
        Search by name, phone, or email.
      </p>

      <div className="relative max-w-md mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search guests..."
          className="w-full rounded-control border border-border bg-surface pl-9 pr-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted text-xs uppercase border-b border-border">
              <th className="p-3 font-medium">Guest</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Room</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr
                key={g.id}
                onClick={() => openGuest(g.id)}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-primary-50/40"
              >
                <td className="p-3 font-medium">{g.fullName}</td>
                <td className="p-3 text-text-secondary">{g.phone ?? "—"}</td>
                <td className="p-3 text-text-secondary">{g.currentRoom ?? "—"}</td>
                <td className="p-3 text-text-secondary">{g.lastStatus?.replace("_", " ") ?? "—"}</td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-text-secondary">
                  No guests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2>{detail?.fullName ?? "Loading..."}</h2>
              <button onClick={() => setSelectedId(null)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            {!detail && <p className="text-sm text-text-secondary">Loading...</p>}

            {detail && (
              <div className="space-y-6">
                <div className="text-sm text-text-secondary space-y-1">
                  <p>Phone: {detail.phone ?? "—"}</p>
                  <p>Email: {detail.email ?? "—"}</p>
                  <p>National ID: {detail.idNumber ?? "—"}</p>
                  <p>Nationality: {detail.nationality ?? "—"}</p>
                  <p>Vehicle Reg: {detail.vehicleRegistration ?? "—"}</p>
                </div>

                <div>
                  <h3 className="mb-2">Stay History</h3>
                  <div className="space-y-2">
                    {detail.reservations.map((r) => (
                      <div key={r.id} className="border border-border rounded-control px-3 py-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {r.rooms.map((rr) => rr.roomNumber).join(", ")} — {r.code}
                          </span>
                          <span className="text-text-secondary">{r.status.replace("_", " ")}</span>
                        </div>
                        <p className="text-text-secondary text-xs mt-0.5">
                          {new Date(r.checkInDate).toLocaleDateString()} –{" "}
                          {new Date(r.checkOutDate).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {detail.reservations.length === 0 && (
                      <p className="text-sm text-text-secondary">No reservations yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2">Financial History</h3>
                  <div className="space-y-2">
                    {detail.folios.map((f) => (
                      <div key={f.id} className="border border-border rounded-control px-3 py-2 text-sm flex justify-between">
                        <span className="text-text-secondary">{f.isClosed ? "Closed folio" : "Open folio"}</span>
                        <span className={f.balance > 0 ? "text-danger font-medium" : "text-success font-medium"}>
                          Balance: KSh {f.balance.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {detail.folios.length === 0 && (
                      <p className="text-sm text-text-secondary">No billing history yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
