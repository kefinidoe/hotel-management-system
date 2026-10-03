"use client";

import type { RoomStatus } from "@prisma/client";
import { ROOM_STATUSES, roomStatusClasses } from "@/lib/room-status";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Settings2 } from "lucide-react";
import clsx from "clsx";

type Room = {
  id: string;
  number: string;
  floor: string | null;
  status: string;
  notes: string | null;
  roomTypeId: string;
  roomTypeName: string;
};

type RoomType = {
  id: string;
  name: string;
  description: string | null;
  baseRate: number;
  capacity: number;
};

const STATUS_OPTIONS = ROOM_STATUSES;

function statusClasses(status: string) {
  return roomStatusClasses(status as RoomStatus);
}

export default function RoomsClient({
  initialRooms,
  initialRoomTypes,
  canManage,
}: {
  initialRooms: Room[];
  initialRoomTypes: RoomType[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Rooms</h1>
          <p className="text-text-secondary text-sm mt-1">
            {initialRooms.length} rooms across floors 1–4. Bookable as Single, Double, or Twin.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setManageTypesOpen(true)} className="btn-secondary">
              <Settings2 size={16} /> Room Types
            </button>
            <button onClick={() => setAddRoomOpen(true)} className="btn-primary">
              <Plus size={16} /> Add Room
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {initialRooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room)}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <div className="relative h-2 bg-gradient-to-r from-primary-500 via-primary-400 to-champagne-400" />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Room
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tracking-tight text-text-primary">
                    {room.number}
                  </p>
                  <p className="mt-1 text-sm font-medium text-text-secondary">
                    {room.roomTypeName}
                  </p>
                </div>

                <span className={clsx(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  statusClasses(room.status)
                )}>
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                  {room.status.replace("_", " ")}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/60 px-2.5 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 text-xs">
                    ♨
                  </span>
                  <span className="text-[11px] font-medium text-text-secondary">Hot shower</span>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/60 px-2.5 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 text-xs">
                    ▣
                  </span>
                  <span className="text-[11px] font-medium text-text-secondary">Study table</span>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/60 px-2.5 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 text-xs">
                    Wi
                  </span>
                  <span className="text-[11px] font-medium text-text-secondary">Free Wi-Fi</span>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-bg/60 px-2.5 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 text-xs">
                    TV
                  </span>
                  <span className="text-[11px] font-medium text-text-secondary">TV</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-text-muted">
                  {room.floor ? `Floor ${room.floor}` : "Room details"}
                </span>
                <span className="text-xs font-semibold text-primary-700 transition-transform duration-200 group-hover:translate-x-0.5">
                  View details →
                </span>
              </div>
            </div>
          </button>
        ))}
        {initialRooms.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
            <p className="text-sm font-medium text-text-primary">No rooms yet</p>
            <p className="mt-1 text-sm text-text-secondary">
              Add your first room to get started.
            </p>
          </div>
        )}
      </div>

      {selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          roomTypes={initialRoomTypes}
          canManage={canManage}
          onClose={() => setSelectedRoom(null)}
          onSaved={refresh}
          onError={setError}
        />
      )}

      {canManage && addRoomOpen && (
        <AddRoomModal
          roomTypes={initialRoomTypes}
          onClose={() => setAddRoomOpen(false)}
          onSaved={refresh}
          onError={setError}
        />
      )}

      {canManage && manageTypesOpen && (
        <RoomTypesModal
          roomTypes={initialRoomTypes}
          onClose={() => setManageTypesOpen(false)}
          onSaved={refresh}
          onError={setError}
        />
      )}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function inputClass() {
  return "w-full rounded-control border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
}

function AddRoomModal({
  roomTypes,
  onClose,
  onSaved,
  onError,
}: {
  roomTypes: RoomType[];
  onClose: () => void;
  onSaved: () => void;
  onError: (e: string | null) => void;
}) {
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, floor, roomTypeId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onError(data.error || "Could not add room.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ModalShell title="Add Room" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Room Number</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} required className={inputClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Floor (optional)</label>
          <input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Room Type</label>
          <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputClass()}>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name} — KSh {rt.baseRate.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? "Adding..." : "Add Room"}
        </button>
      </form>
    </ModalShell>
  );
}

function RoomDetailModal({
  room,
  roomTypes,
  canManage,
  onClose,
  onSaved,
  onError,
}: {
  room: Room;
  roomTypes: RoomType[];
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (e: string | null) => void;
}) {
  const [status, setStatus] = useState(room.status);
  const [notes, setNotes] = useState(room.notes ?? "");
  const [roomTypeId, setRoomTypeId] = useState(room.roomTypeId);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    onError(null);
    const res = await fetch(`/api/rooms/${room.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: room.number, floor: room.floor, roomTypeId, status, notes }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onError(data.error || "Could not update room.");
      return;
    }
    onSaved();
    onClose();
  }

  async function remove() {
    if (
      !confirm(
        `Remove room ${room.number} from the hotel? It will disappear from active rooms and future bookings, while existing history will be kept.`
      )
    ) {
      return;
    }
    setLoading(true);
    onError(null);
    const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onError(data.error || "Could not remove room from the hotel.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={`Room ${room.number}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-control border border-border bg-bg/60 p-3 text-xs">
          <p className="font-semibold text-text-primary">Flexible Room</p>
          <p className="mt-1 text-text-secondary leading-relaxed">
            This room is not tied to a single category. The receptionist chooses{' '}
            <strong className="text-text-primary">Single, Double, or Twin</strong> and the meal plan when creating each reservation.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!canManage}
            className={inputClass()}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            readOnly={!canManage}
            rows={3}
            className={inputClass()}
          />
        </div>
        {canManage ? (
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={remove} disabled={loading} className="btn-secondary text-danger">
              Remove from hotel
            </button>
          </div>
        ) : (
          <button onClick={onClose} className="btn-secondary w-full mt-2">
            Close
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function RoomTypesModal({
  roomTypes,
  onClose,
  onSaved,
  onError,
}: {
  roomTypes: RoomType[];
  onClose: () => void;
  onSaved: () => void;
  onError: (e: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [loading, setLoading] = useState(false);

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const res = await fetch("/api/room-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, baseRate: Number(baseRate), capacity: Number(capacity) }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onError(data.error || "Could not add room type.");
      return;
    }
    setName("");
    setBaseRate("");
    onSaved();
  }

  async function removeType(id: string) {
    if (!confirm("Delete this room type?")) return;
    const res = await fetch(`/api/room-types/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      onError(data.error || "Could not delete room type.");
      return;
    }
    onSaved();
  }

  return (
    <ModalShell title="Room Types" onClose={onClose}>
      <div className="space-y-2 mb-4">
        {roomTypes.map((rt) => (
          <div key={rt.id} className="flex items-center justify-between border border-border rounded-control px-3 py-2">
            <div>
              <p className="text-sm font-medium">{rt.name}</p>
              <p className="text-xs text-text-secondary">
                KSh {rt.baseRate.toLocaleString()} · sleeps {rt.capacity}
              </p>
            </div>
            <button onClick={() => removeType(rt.id)} className="text-text-secondary hover:text-danger">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addType} className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium">Add a room type</p>
        <input placeholder="Name (e.g. Deluxe)" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass()} />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Rate (KSh)"
            type="number"
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
            required
            className={inputClass()}
          />
          <input
            placeholder="Capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className={inputClass()}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Adding..." : "Add Room Type"}
        </button>
      </form>
    </ModalShell>
  );
}
