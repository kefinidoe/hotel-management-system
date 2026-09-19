"use client";

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

const STATUS_OPTIONS = [
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "DIRTY",
  "CLEANING",
  "READY",
  "MAINTENANCE",
  "OUT_OF_ORDER",
];

function statusClasses(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "bg-primary-50 text-primary-700";
    case "READY":
      return "bg-primary-50 text-primary-700";
    case "OCCUPIED":
      return "bg-champagne-50 text-champagne-500";
    case "RESERVED":
      return "bg-info/10 text-info";
    case "CLEANING":
      return "bg-info/10 text-info";
    case "DIRTY":
      return "bg-warning/10 text-warning";
    case "MAINTENANCE":
    case "OUT_OF_ORDER":
      return "bg-danger/10 text-danger";
    default:
      return "bg-bg text-text-secondary";
  }
}

export default function RoomsClient({
  initialRooms,
  initialRoomTypes,
}: {
  initialRooms: Room[];
  initialRoomTypes: RoomType[];
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
            {initialRooms.length} rooms across {initialRoomTypes.length} room types.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setManageTypesOpen(true)} className="btn-secondary">
            <Settings2 size={16} /> Room Types
          </button>
          <button onClick={() => setAddRoomOpen(true)} className="btn-primary">
            <Plus size={16} /> Add Room
          </button>
        </div>
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
            className="card text-left hover:border-primary-300 transition-colors"
          >
            <p className="text-lg font-semibold">{room.number}</p>
            <p className="text-sm text-text-secondary">{room.roomTypeName}</p>
            <span className={clsx("badge mt-3", statusClasses(room.status))}>
              {room.status.replace("_", " ")}
            </span>
          </button>
        ))}
        {initialRooms.length === 0 && (
          <p className="text-text-secondary text-sm col-span-full">
            No rooms yet. Add your first room to get started.
          </p>
        )}
      </div>

      {selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          roomTypes={initialRoomTypes}
          onClose={() => setSelectedRoom(null)}
          onSaved={refresh}
          onError={setError}
        />
      )}

      {addRoomOpen && (
        <AddRoomModal
          roomTypes={initialRoomTypes}
          onClose={() => setAddRoomOpen(false)}
          onSaved={refresh}
          onError={setError}
        />
      )}

      {manageTypesOpen && (
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
  onClose,
  onSaved,
  onError,
}: {
  room: Room;
  roomTypes: RoomType[];
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
    if (!confirm(`Delete room ${room.number}?`)) return;
    setLoading(true);
    const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      onError(data.error || "Could not delete room.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={`Room ${room.number}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Room Type</label>
          <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputClass()}>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass()}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass()} />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={save} disabled={loading} className="btn-primary flex-1">
            {loading ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={remove} disabled={loading} className="btn-secondary text-danger">
            Delete
          </button>
        </div>
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
