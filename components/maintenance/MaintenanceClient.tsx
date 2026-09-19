"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  cost: number | null;
  roomId: string | null;
  roomNumber: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
};
type Room = { id: string; number: string };
type Staff = { id: string; name: string; role: string };

const COLUMNS = [
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "WAITING_PARTS", label: "Waiting Parts" },
  { key: "COMPLETED", label: "Completed" },
];

function inputClass() {
  return "w-full rounded-control border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
}

export default function MaintenanceClient({
  initialTickets,
  rooms,
  staff,
}: {
  initialTickets: Ticket[];
  rooms: Room[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Maintenance</h1>
          <p className="text-text-secondary text-sm mt-1">Track repair and upkeep tickets by room.</p>
        </div>
        <button onClick={() => setNewOpen(true)} className="btn-primary">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = initialTickets.filter((t) => t.status === col.key);
          return (
            <div key={col.key}>
              <h2 className="mb-3 text-sm">{col.label} ({items.length})</h2>
              <div className="space-y-3">
                {items.map((t) => (
                  <button key={t.id} onClick={() => setSelected(t)} className="card text-left w-full hover:border-primary-300">
                    <p className="font-medium">{t.roomNumber ? `Room ${t.roomNumber}` : "General"}</p>
                    <p className="text-sm text-text-secondary">{t.title}</p>
                    <span className="badge bg-danger/10 text-danger capitalize mt-2">{t.priority}</span>
                  </button>
                ))}
                {items.length === 0 && <p className="text-xs text-text-muted">Nothing here.</p>}
              </div>
            </div>
          );
        })}
      </div>

      {newOpen && (
        <NewTicketModal
          rooms={rooms}
          onClose={() => setNewOpen(false)}
          onCreated={refresh}
          onError={setError}
        />
      )}

      {selected && (
        <TicketDetailModal
          ticket={selected}
          staff={staff}
          onClose={() => setSelected(null)}
          onSaved={refresh}
          onError={setError}
        />
      )}
    </div>
  );
}

function NewTicketModal({
  rooms,
  onClose,
  onCreated,
  onError,
}: {
  rooms: Room[];
  onClose: () => void;
  onCreated: () => void;
  onError: (e: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [takeOutOfService, setTakeOutOfService] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, roomId: roomId || null, priority, takeOutOfService }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || "Could not create ticket.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>New Maintenance Ticket</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Shower leaking" className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Room (optional)</label>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputClass()}>
              <option value="">General / not room-specific</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass()}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass()} />
          </div>
          {roomId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={takeOutOfService} onChange={(e) => setTakeOutOfService(e.target.checked)} />
              Take this room out of service until resolved
            </label>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? "Creating..." : "Create Ticket"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TicketDetailModal({
  ticket,
  staff,
  onClose,
  onSaved,
  onError,
}: {
  ticket: Ticket;
  staff: Staff[];
  onClose: () => void;
  onSaved: () => void;
  onError: (e: string | null) => void;
}) {
  const [status, setStatus] = useState(ticket.status);
  const [assigneeId, setAssigneeId] = useState(ticket.assigneeId ?? "");
  const [cost, setCost] = useState(ticket.cost?.toString() ?? "");
  const [description, setDescription] = useState(ticket.description ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    onError(null);
    const res = await fetch(`/api/maintenance/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        assigneeId: assigneeId || null,
        cost: cost ? Number(cost) : null,
        description,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || "Could not update ticket.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>{ticket.title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            {ticket.roomNumber ? `Room ${ticket.roomNumber}` : "General"}
          </p>
          <div>
            <label className="block text-sm font-medium mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass()}>
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Assigned to</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass()}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Cost (KSh, optional)</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass()} />
          </div>
          <button onClick={save} disabled={loading} className="btn-primary w-full">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
