"use client";

import { useState } from "react";
import { Search, X, Archive, RotateCcw } from "lucide-react";

type GuestRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isArchived: boolean;
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
  isArchived: boolean;
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
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [archiving, setArchiving] = useState(false);

  async function search(q: string, includeArchived = showArchived) {
    setQuery(q);
    const params = new URLSearchParams({ q });
    if (includeArchived) params.set("includeArchived", "true");
    const res = await fetch(`/api/guests?${params.toString()}`);
    setGuests(await res.json());
  }

  function toggleShowArchived() {
    const next = !showArchived;
    setShowArchived(next);
    search(query, next);
  }

  async function openGuest(id: string) {
    setSelectedId(id);
    setDetail(null);
    const res = await fetch(`/api/guests/${id}`);
    setDetail(await res.json());
  }

  async function setArchived(id: string, isArchived: boolean) {
    if (isArchived && !confirm("Archive this guest? They'll be hidden from the list, but all their stay and payment history stays intact and can be restored anytime.")) {
      return;
    }
    setArchiving(true);
    const res = await fetch(`/api/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived }),
    });
    setArchiving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Something went wrong.");
      return;
    }

    setDetail((d) => (d ? { ...d, isArchived } : d));
    search(query); // refresh the list so it reflects the change
  }

  return (
    <div>
      <h1>Guests</h1>
      <p className="text-text-secondary text-sm mt-1 mb-4">
        Search by name, phone, or email.
      </p>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search guests..."
            className="w-full rounded-control border border-border bg-surface pl-9 pr-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={toggleShowArchived} />
          Show archived
        </label>
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
                <td className="p-3 font-medium">
                  {g.fullName}
                  {g.isArchived && (
                    <span className="ml-2 text-xs text-text-muted border border-border rounded px-1.5 py-0.5">
                      Archived
                    </span>
                  )}
                </td>
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

                <div className="pt-2 border-t border-border">
                  {detail.isArchived ? (
                    <button
                      onClick={() => setArchived(detail.id, false)}
                      disabled={archiving}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    >
                      <RotateCcw size={16} /> Restore guest
                    </button>
                  ) : (
                    <button
                      onClick={() => setArchived(detail.id, true)}
                      disabled={archiving || detail.reservations.some((r) => r.status === "CHECKED_IN")}
                      className="flex items-center gap-2 text-sm text-danger hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        detail.reservations.some((r) => r.status === "CHECKED_IN")
                          ? "Can't archive a guest who is currently checked in"
                          : undefined
                      }
                    >
                      <Archive size={16} /> Archive guest
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}