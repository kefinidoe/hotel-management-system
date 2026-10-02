"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import type { RoleName } from "@prisma/client";
import CreateReservationModal from "@/components/reservations/CreateReservationModal";
import FolioModal from "./FolioModal";
import CheckInModal from "./CheckInModal";
import ExtendStayModal from "./ExtendStayModal";
import { hasRole, ROLE_GROUPS } from "@/lib/permissions";
import type { RoomStatus } from "@prisma/client";
import {
  isBookableToday,
  ROOM_STATUS_HINTS,
  ROOM_STATUS_LABELS,
  roomStatusClasses,
  roomStatusDotClasses,
  summariseRooms,
} from "@/lib/room-status";

type ResRow = {
  id: string;
  code: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  roomId: string;
  roomNumbers: string;
  openFolioId: string | null;
  requiredAmount: number;
  paidAmount: number;
  balance: number;
  nightlyRateTotal: number;
};
type Room = {
  id: string;
  number: string;
  floor: string | null;
  status: RoomStatus;
  roomTypeName: string;
  baseRate: number;
};

function money(value: number) {
  return `KSh ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FrontDeskClient({
  currentUserRole,
  arrivals,
  departures,
  inHouse,
  availableRoomsCount,
  rooms,
}: {
  currentUserRole: RoleName;
  arrivals: ResRow[];
  departures: ResRow[];
  inHouse: ResRow[];
  availableRoomsCount: number;
  rooms: Room[];
}) {
  const router = useRouter();
  const canManageStays = hasRole(currentUserRole, ROLE_GROUPS.GUEST_STAYS);
  const canOverrideBalance = hasRole(currentUserRole, ROLE_GROUPS.MANAGEMENT);
  const [error, setError] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkInReservation, setCheckInReservation] = useState<ResRow | null>(null);
  const [extendReservation, setExtendReservation] = useState<ResRow | null>(null);
  const [openFolio, setOpenFolio] = useState<{ folioId: string; reservationId: string } | null>(null);

  const roomSummary = summariseRooms(rooms);
  const roomsByFloor = rooms.reduce<Record<string, Room[]>>((groups, room) => {
    const floor = room.floor ?? "Other";
    (groups[floor] ??= []).push(room);
    return groups;
  }, {});

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 shadow-sm">
              <span className="text-lg">⌂</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Front Desk</h1>
              <p className="text-text-secondary text-sm mt-0.5">
                Manage arrivals, departures and in-house guests.
              </p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
            <span className="h-2 w-2 rounded-full bg-primary-500" />
            {availableRoomsCount} rooms available today
            <span className="text-primary-300">•</span>
            Check-out at 10:00 AM
          </div>
        </div>

        {canManageStays && (
          <button
            onClick={() => setWalkInOpen(true)}
            className="btn-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <UserPlus size={17} /> Walk-in
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-2xl px-4 py-3 mb-5 shadow-sm">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold">Room Status</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {roomSummary.bookable} of {roomSummary.total} rooms free and clean right now
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-medium rounded-control border border-border px-3 py-1.5 hover:bg-bg"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
          {Array.from(roomSummary.counts.entries()).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <span className={`h-2 w-2 rounded-full ${roomStatusDotClasses(status)}`} />
              {ROOM_STATUS_LABELS[status]}: <span className="font-semibold">{count}</span>
            </span>
          ))}
        </div>

        <div className="space-y-3">
          {Object.entries(roomsByFloor)
            .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
            .map(([floor, floorRooms]) => (
              <div key={floor}>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
                  {floor === "Other" ? "Other rooms" : `Floor ${floor}`}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {floorRooms.map((room) => (
                    <div
                      key={room.id}
                      title={ROOM_STATUS_HINTS[room.status]}
                      className={`rounded-control border px-2.5 py-1.5 ${roomStatusClasses(room.status)}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${roomStatusDotClasses(room.status)}`} />
                        <span className="text-sm font-semibold text-text-primary">{room.number}</span>
                      </div>
                      <p className="text-[11px] font-medium mt-0.5">{ROOM_STATUS_LABELS[room.status]}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-bold">Arrivals</h2>
              <p className="text-xs text-text-secondary mt-0.5">Guests checking in today</p>
            </div>
            <span className="min-w-8 h-8 px-2 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xs font-bold">
              {arrivals.length}
            </span>
          </div>

          <div className="space-y-3">
            {arrivals.map((r) => (
              <div
                key={r.id}
                className="group rounded-2xl border border-border bg-bg/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.guestName}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Room {r.roomNumbers} <span className="mx-1">·</span> {r.code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700">
                    Arrival
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-control bg-surface px-3 py-2 text-xs">
                  <span className="text-text-secondary">Accommodation required</span>
                  <span className="font-semibold">{money(r.requiredAmount)}</span>
                </div>

                {canManageStays && (
                  <button
                    onClick={() => {
                      setError(null);
                      setCheckInReservation(r);
                    }}
                    className="btn-primary w-full mt-4 transition-all duration-200 group-hover:shadow-sm"
                  >
                    Check In
                  </button>
                )}
              </div>
            ))}
            {arrivals.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-text-primary">No arrivals today</p>
                <p className="text-xs text-text-secondary mt-1">You’re all caught up.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-bold">Departures</h2>
              <p className="text-xs text-text-secondary mt-0.5">Guests checking out today</p>
            </div>
            <span className="min-w-8 h-8 px-2 rounded-full bg-champagne-50 text-champagne-500 flex items-center justify-center text-xs font-bold">
              {departures.length}
            </span>
          </div>

          <div className="space-y-3">
            {departures.map((r) => (
              <div
                key={r.id}
                className="group rounded-2xl border border-border bg-bg/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.guestName}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Room {r.roomNumbers} <span className="mx-1">·</span> {r.code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-champagne-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-champagne-500">
                    Departure
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-control bg-surface px-3 py-2 text-xs">
                  <div>
                    <p className="text-text-muted">Required</p>
                    <p className="font-medium">{money(r.requiredAmount)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Paid</p>
                    <p className="font-medium text-success">{money(r.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Balance</p>
                    <p className={r.balance > 0 ? "font-semibold text-danger" : "font-semibold text-success"}>
                      {money(r.balance)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    r.openFolioId
                      ? setOpenFolio({ folioId: r.openFolioId, reservationId: r.id })
                      : setError("No open folio found for this reservation.")
                  }
                  className="btn-secondary w-full mt-4 transition-all duration-200 group-hover:border-primary-200"
                >
                  View Folio / Check Out
                </button>
              </div>
            ))}
            {departures.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-text-primary">No departures today</p>
                <p className="text-xs text-text-secondary mt-1">No check-outs are scheduled.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-bold">In-house Guests</h2>
              <p className="text-xs text-text-secondary mt-0.5">Currently staying at the hotel</p>
            </div>
            <span className="min-w-8 h-8 px-2 rounded-full bg-info/10 text-info flex items-center justify-center text-xs font-bold">
              {inHouse.length}
            </span>
          </div>

          <div className="space-y-3">
            {inHouse.map((r) => (
              <div
                key={r.id}
                className="group rounded-2xl border border-border bg-bg/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.guestName}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Room {r.roomNumbers} <span className="mx-1">·</span> until{" "}
                      {new Date(r.checkOutDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-info/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-info">
                    In-house
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-control bg-surface px-3 py-2 text-xs">
                  <div>
                    <p className="text-text-muted">Required</p>
                    <p className="font-medium">{money(r.requiredAmount)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Paid</p>
                    <p className="font-medium text-success">{money(r.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Balance</p>
                    <p className={r.balance > 0 ? "font-semibold text-danger" : "font-semibold text-success"}>
                      {money(r.balance)}
                    </p>
                  </div>
                </div>

                <div className={`mt-4 grid gap-2 ${canManageStays ? "grid-cols-2" : "grid-cols-1"}`}>
                  <button
                    onClick={() =>
                      r.openFolioId
                        ? setOpenFolio({ folioId: r.openFolioId, reservationId: r.id })
                        : setError("No open folio found for this reservation.")
                    }
                    className="btn-secondary w-full transition-all duration-200 group-hover:border-primary-200"
                  >
                    View Folio
                  </button>
                  {canManageStays && (
                    <button
                      onClick={() => {
                        setError(null);
                        setExtendReservation(r);
                      }}
                      className="btn-primary w-full"
                    >
                      Add Days
                    </button>
                  )}
                </div>
              </div>
            ))}
            {inHouse.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-text-primary">No guests currently in-house</p>
                <p className="text-xs text-text-secondary mt-1">Active stays will appear here.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {canManageStays && walkInOpen && rooms.length > 0 && (
        <CreateReservationModal
          rooms={rooms}
          defaultRoomId={rooms[0].id}
          defaultDate={new Date()}
          canApplyDiscount={canOverrideBalance}
          onClose={() => setWalkInOpen(false)}
          onCreated={() => refresh()}
          onError={setError}
        />
      )}

      {checkInReservation && (
        <CheckInModal
          reservation={checkInReservation}
          rooms={rooms.map((room) => ({ id: room.id, number: room.number, status: room.status }))}
          onClose={() => setCheckInReservation(null)}
          onCheckedIn={(folioId) => {
            refresh();
            setOpenFolio({ folioId, reservationId: checkInReservation.id });
          }}
        />
      )}

      {extendReservation && (
        <ExtendStayModal
          reservation={extendReservation}
          onClose={() => setExtendReservation(null)}
          onExtended={(folioId) => {
            refresh();
            setOpenFolio({ folioId, reservationId: extendReservation.id });
          }}
        />
      )}

      {openFolio && (
        <FolioModal
          folioId={openFolio.folioId}
          reservationId={openFolio.reservationId}
          canCheckout={canManageStays}
          canOverrideBalance={canOverrideBalance}
          onClose={() => setOpenFolio(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
