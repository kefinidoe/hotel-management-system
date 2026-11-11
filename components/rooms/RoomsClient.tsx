"use client";

import { useState } from "react";
import { 
  Plus, 
  Settings2, 
  LayoutGrid, 
  Search, 
  BedDouble, 
  Map, 
  ChevronRight,
  Sparkles,
  Wrench,
  Ban,
  Clock
} from "lucide-react";
import clsx from "clsx";
import type { RoleName } from "@prisma/client";
import { hasRole, ROLE_GROUPS } from "@/lib/permissions";
import ModalShell from "@/components/ModalShell";

type RoomType = {
  id: string;
  name: string;
  baseRate: number;
};

type Room = {
  id: string;
  number: string;
  floor: string | null;
  status: string;
  notes: string | null;
  roomTypeId: string;
  roomTypeName: string;
};

const STATUS_CONFIG: Record<string, { icon: any, label: string, color: string, bg: string, ring: string }> = {
  AVAILABLE: { icon: BedDouble, label: "Available", color: "text-teal-600", bg: "bg-teal-50", ring: "ring-teal-500/20" },
  OCCUPIED: { icon: Clock, label: "Occupied", color: "text-gold-600", bg: "bg-gold-50", ring: "ring-gold-500/20" },
  DIRTY: { icon: Sparkles, label: "Needs Cleaning", color: "text-info", bg: "bg-info-bg", ring: "ring-info/20" },
  MAINTENANCE: { icon: Wrench, label: "Maintenance", color: "text-danger", bg: "bg-danger-bg", ring: "ring-danger/20" },
  OUT_OF_ORDER: { icon: Ban, label: "Out of Order", color: "text-text-muted", bg: "bg-bg", ring: "ring-border/40" },
};

export default function RoomsClient({
  currentUserRole,
  initialRooms,
  initialRoomTypes,
}: {
  currentUserRole: RoleName;
  initialRooms: Room[];
  initialRoomTypes: RoomType[];
}) {
  const [rooms, setRooms] = useState(initialRooms);
  const [roomTypes, setRoomTypes] = useState(initialRoomTypes);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasRole(currentUserRole, ROLE_GROUPS.MANAGEMENT);

  const refresh = () => window.location.reload();

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-500">Rooms & Inventory</h1>
          <p className="text-text-secondary mt-1 font-medium">
            {initialRooms.length} rooms across floors 1–4. Bookable as Single, Double, or Twin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <button className="btn-secondary">
               <Settings2 size={18} />
               Room Types
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {rooms.map((room) => {
          const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.AVAILABLE;
          const Icon = config.icon;
          
          return (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className="group relative flex flex-col bg-white rounded-3xl border border-border shadow-sm hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ring-1 ring-transparent hover:ring-navy-500/10"
            >
              <div className={clsx("h-1.5 w-full", config.bg.replace("bg-", "bg-"))} style={{backgroundColor: "var(--tw-color-" + config.color.split("-")[1] + "-500)"}} />
              
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-0.5">Room</p>
                    <p className="text-3xl font-black text-navy-500 tracking-tighter">{room.number}</p>
                  </div>
                  <div className={clsx("p-2 rounded-xl shadow-sm border border-white", config.bg, config.color)}>
                     <Icon size={20} strokeWidth={2.5} />
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className={clsx(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    config.bg, config.color, config.ring.replace("ring-", "border-")
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_4px_currentColor]" />
                    {config.label}
                  </div>

                  <div className="grid grid-cols-2 gap-2 opacity-60">
                     <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase">
                        <div className="w-1 h-1 rounded-full bg-border" />
                        WiFi
                     </div>
                     <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase">
                        <div className="w-1 h-1 rounded-full bg-border" />
                        TV
                     </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between group-hover:border-navy-100 transition-colors">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    {room.floor ? `Floor ${room.floor}` : "Ground"}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-black text-navy-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    DETAILS <ChevronRight size={12} strokeWidth={3} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
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
    </div>
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
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    onError(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, number: room.number, floor: room.floor, roomTypeId: room.roomTypeId }),
      });
      if (!res.ok) throw new Error("Update failed");
      onSaved();
      onClose();
    } catch {
      onError("Could not update room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={`Room ${room.number} Control`} onClose={onClose}>
      <div className="space-y-6">
        <div className="bg-navy-50 border border-navy-100 rounded-2xl p-4 flex gap-4">
           <div className="w-12 h-12 rounded-xl bg-navy-500 text-white flex items-center justify-center text-xl font-black">
              {room.number}
           </div>
           <div>
              <p className="text-xs font-black text-navy-400 uppercase tracking-widest">Flexible Unit</p>
              <p className="text-sm font-bold text-navy-900 mt-0.5">Bookable as Single, Double or Twin</p>
           </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">Room Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={!canManage}
              className="w-full"
            >
              {Object.keys(STATUS_CONFIG).map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">Status Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canManage}
              placeholder="E.g. Cleaning in progress, Light bulb needs replacement..."
              className="w-full h-24 resize-none"
            />
          </div>
        </div>

        {canManage && (
          <div className="pt-2">
            <button
              onClick={save}
              disabled={loading}
              className="btn-primary w-full shadow-lg"
            >
              {loading ? "Updating..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
