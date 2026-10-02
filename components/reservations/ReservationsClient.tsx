"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import clsx from "clsx";
import type { RoleName } from "@prisma/client";
import { startOfWeek, addDays, isoDay } from "@/lib/dates";
import { hasRole, ROLE_GROUPS } from "@/lib/permissions";
import type { RoomStatus } from "@prisma/client";
import CreateReservationModal from "./CreateReservationModal";

type Room = { id: string; number: string; roomTypeName: string; baseRate: number; status: RoomStatus };
type Reservation = {
  id: string;
  code: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestPhone: string | null;
  rooms: { roomId: string; roomNumber: string; rate: number }[];
};

function canEditReservation(status: string) {
  return status === "PENDING" || status === "CONFIRMED";
}

function statusBarClasses(status: string) {
  switch (status) {
    case "CHECKED_IN":
      return "bg-primary-500 text-white";
    case "CONFIRMED":
      return "bg-primary-100 text-primary-700 border border-primary-300";
    case "PENDING":
      return "bg-champagne-200 text-text-primary";
    default:
      return "bg-bg text-text-secondary border border-border";
  }
}

export default function ReservationsClient({
  rooms,
  currentUserRole,
}: {
  rooms: Room[];
  currentUserRole: RoleName;
}) {
  const canApplyDiscount = hasRole(currentUserRole, ROLE_GROUPS.MANAGEMENT);
  const [weekOffset, setWeekOffset] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createFor, setCreateFor] = useState<{ roomId: string; date: Date } | null>(null);

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reservations?from=${isoDay(weekStart)}&to=${isoDay(weekEnd)}`);
    const data = await res.json();
    setReservations(data);
    setLoading(false);
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  function barsForRoom(roomId: string) {
    return reservations
      .filter((r) => r.rooms.some((rr) => rr.roomId === roomId) && r.status !== "CANCELLED" && r.status !== "NO_SHOW")
      .map((r) => {
        const checkIn = new Date(r.checkInDate);
        const checkOut = new Date(r.checkOutDate);
        const startCol = Math.max(0, Math.round((checkIn.getTime() - weekStart.getTime()) / 86400000));
        const endCol = Math.min(7, Math.round((checkOut.getTime() - weekStart.getTime()) / 86400000));
        return { reservation: r, startCol, span: Math.max(1, endCol - startCol) };
      })
      .filter((b) => b.span > 0 && b.startCol < 7);
  }

  function handleDrop(targetRoomId: string, targetCol: number, e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    const { id, checkInDate, checkOutDate, originalStartCol } = JSON.parse(raw);
    const dayDelta = targetCol - originalStartCol;
    const newCheckIn = addDays(new Date(checkInDate), dayDelta);
    const newCheckOut = addDays(new Date(checkOutDate), dayDelta);

    fetch(`/api/reservations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkInDate: newCheckIn.toISOString(),
        checkOutDate: newCheckOut.toISOString(),
        roomId: targetRoomId,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not move reservation.");
        return;
      }
      setError(null);
      load();
    });
  }

  async function cancelReservation(id: string) {
    if (!confirm("Cancel this reservation?")) return;
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not cancel the reservation.");
      return;
    }
    setError(null);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Reservations</h1>
          <p className="text-text-secondary text-sm mt-1">
            Drag a booking to a different day or room. Click an empty slot to create a new one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="btn-secondary px-2">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium w-40 text-center">
            {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="btn-secondary px-2">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="card p-0 overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Day header */}
          <div className="grid grid-cols-[120px_repeat(7,1fr)] border-b border-border">
            <div className="p-3 text-xs font-medium text-text-muted uppercase">Room</div>
            {days.map((d) => (
              <div key={d.toISOString()} className="p-3 text-center border-l border-border">
                <p className="text-xs text-text-muted uppercase">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className="text-sm font-medium">{d.getDate()}</p>
              </div>
            ))}
          </div>

          {rooms.map((room) => (
            <div key={room.id} className="grid grid-cols-[120px_repeat(7,1fr)] border-b border-border last:border-0">
              <div className="p-3 border-r border-border">
                <p className="text-sm font-medium">{room.number}</p>
                <p className="text-xs text-text-secondary">{room.roomTypeName}</p>
              </div>

              <div className="relative col-span-7" style={{ height: 56 }}>
                <div className="absolute inset-0 grid grid-cols-7">
                  {days.map((d, colIndex) => (
                    <div
                      key={colIndex}
                      className="border-l border-border hover:bg-primary-50/40 cursor-pointer"
                      onClick={() => setCreateFor({ roomId: room.id, date: d })}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(room.id, colIndex, e)}
                    />
                  ))}
                </div>

                {barsForRoom(room.id).map(({ reservation, startCol, span }) => (
                  <div
                    key={reservation.id}
                    draggable={canEditReservation(reservation.status)}
                    onDragStart={(e) => {
                      if (!canEditReservation(reservation.status)) return;
                      e.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({
                          id: reservation.id,
                          checkInDate: reservation.checkInDate,
                          checkOutDate: reservation.checkOutDate,
                          originalStartCol: startCol,
                        })
                      );
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEditReservation(reservation.status)) {
                        cancelReservation(reservation.id);
                      }
                    }}
                    title={
                      canEditReservation(reservation.status)
                        ? `${reservation.guestName} — ${reservation.code} (click to cancel)`
                        : `${reservation.guestName} — ${reservation.code} (manage from Front Desk)`
                    }
                    className={clsx(
                      "absolute top-1.5 bottom-1.5 rounded-control px-2 py-1 text-xs font-medium truncate",
                      canEditReservation(reservation.status) ? "cursor-grab" : "cursor-default",
                      statusBarClasses(reservation.status)
                    )}
                    style={{
                      left: `${(startCol / 7) * 100}%`,
                      width: `calc(${(span / 7) * 100}% - 4px)`,
                    }}
                  >
                    {reservation.guestName}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {rooms.length === 0 && (
            <p className="p-6 text-sm text-text-secondary">Add rooms first, then reservations can be created here.</p>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-text-secondary mt-3">Loading...</p>}

      {createFor && (
        <CreateReservationModal
          rooms={rooms}
          defaultRoomId={createFor.roomId}
          defaultDate={createFor.date}
          canApplyDiscount={canApplyDiscount}
          onClose={() => setCreateFor(null)}
          onCreated={load}
          onError={setError}
        />
      )}
    </div>
  );
}

