"use client";

import { useState } from "react";
import { 
  Users, 
  LogIn, 
  LogOut, 
  BedDouble, 
  Plus, 
  AlertCircle 
} from "lucide-react";
import clsx from "clsx";
import type { RoleName } from "@prisma/client";
import { hasRole, ROLE_GROUPS } from "@/lib/permissions";
import CreateReservationModal from "@/components/reservations/CreateReservationModal";
import CheckInModal from "@/components/frontdesk/CheckInModal";
import ExtendStayModal from "@/components/frontdesk/ExtendStayModal";
import FolioModal from "@/components/frontdesk/FolioModal";

type ResRow = {
  id: string;
  code: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  checkoutDeadline?: string;
  isOverdue?: boolean;
  roomId: string;
  roomNumbers: string;
  openFolioId: string | null;
  requiredAmount: number;
  paidAmount: number;
  balance: number;
  nightlyRateTotal: number;
};

type RoomRow = {
  id: string;
  number: string;
  floor: string | null;
  status: string;
  roomTypeName: string;
  baseRate: number;
};

function money(value: number) {
  return `KSh ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TAB_ICONS = {
  arrivals: LogIn,
  departures: LogOut,
  inHouse: BedDouble,
};

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
  rooms: RoomRow[];
}) {
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures" | "inHouse">("arrivals");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkInReservation, setCheckInReservation] = useState<ResRow | null>(null);
  const [extendReservation, setExtendReservation] = useState<ResRow | null>(null);
  const [openFolio, setOpenFolio] = useState<{ folioId: string; reservationId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageStays = hasRole(currentUserRole, ROLE_GROUPS.GUEST_STAYS);
  const canOverrideBalance = hasRole(currentUserRole, ROLE_GROUPS.MANAGEMENT);

  const activeList = {
    arrivals,
    departures,
    inHouse,
  }[activeTab];

  const refresh = () => {
    window.location.reload();
  };

  const EmptyIcon = TAB_ICONS[activeTab];

  const getEmptyMessage = () => {
    if (activeTab === "inHouse") return "in-house guests";
    if (activeTab === "arrivals") return "arrivals";
    return "departures";
  };

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-500">Front Desk</h1>
          <p className="text-text-secondary mt-1 font-medium">
            Manage daily operations and guest movements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-border rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(28,152,158,0.5)] animate-pulse" />
             <span className="text-sm font-bold text-navy-600">{availableRoomsCount} Rooms Available</span>
          </div>
          {canManageStays && (
            <button onClick={() => setWalkInOpen(true)} className="btn-teal">
              <Plus size={18} />
              New Walk-in
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden p-1.5 flex gap-1 w-full max-w-lg">
        {[
          { id: "arrivals", label: "Arrivals", count: arrivals.length, color: "text-navy-500", activeBg: "bg-navy-50" },
          { id: "departures", label: "Departures", count: departures.length, color: "text-gold-600", activeBg: "bg-gold-50" },
          { id: "inHouse", label: "In-house", count: inHouse.length, color: "text-teal-600", activeBg: "bg-teal-50" },
        ].map((t) => {
          const Icon = TAB_ICONS[t.id as keyof typeof TAB_ICONS];
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                active 
                  ? `${t.activeBg} ${t.color} shadow-sm border border-border/40` 
                  : "text-text-secondary hover:bg-bg"
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              {t.label}
              <span className={clsx(
                "ml-1 px-1.5 py-0.5 rounded-lg text-[10px] border font-black tracking-tighter transition-colors",
                active ? "bg-white border-white/50" : "bg-bg border-border"
              )}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger/20 p-4 rounded-xl flex items-center gap-3 text-danger shadow-sm">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-xs font-black uppercase underline decoration-2 underline-offset-4">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeList.map((r) => {
          const isDeparture = activeTab === "departures";
          const isArrival = activeTab === "arrivals";
          const isInHouse = activeTab === "inHouse";

          return (
            <div
              key={r.id}
              className={clsx(
                "card-interactive flex flex-col group h-full",
                r.isOverdue && isDeparture ? "ring-2 ring-danger ring-offset-2" : ""
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg leading-tight truncate text-navy-500">{r.guestName}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-bold text-text-muted bg-bg px-2 py-0.5 rounded-lg border border-border">
                      Room {r.roomNumbers}
                    </span>
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-widest text-[10px]">
                      {r.code}
                    </span>
                  </div>
                </div>
                <div className={clsx(
                  "p-2 rounded-xl shadow-sm",
                  isArrival ? "bg-navy-50 text-navy-600" : isDeparture ? "bg-gold-50 text-gold-600" : "bg-teal-50 text-teal-600"
                )}>
                  {isArrival ? <LogIn size={20} /> : isDeparture ? <LogOut size={20} /> : <BedDouble size={20} />}
                </div>
              </div>

              {isDeparture && r.checkoutDeadline && (
                <div className={clsx(
                  "mb-4 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border",
                  r.isOverdue 
                    ? "bg-danger-bg text-danger border-danger/20 animate-pulse" 
                    : "bg-bg text-text-secondary border-border"
                )}>
                  <AlertCircle size={14} className={r.isOverdue ? "text-danger" : "text-text-muted"} />
                  {r.isOverdue ? "CHECKOUT OVERDUE" : `Checkout ends at ${new Date(r.checkoutDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </div>
              )}

              <div className="bg-bg/40 border border-border/50 rounded-xl p-3 flex flex-col gap-2 mb-6 mt-auto">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-text-muted uppercase tracking-wider">Required</span>
                  <span className="text-navy-500">{money(r.requiredAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-text-muted uppercase tracking-wider">Paid</span>
                  <span className="text-success">{money(r.paidAmount)}</span>
                </div>
                <div className="h-px bg-border/50 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase text-text-muted tracking-widest">Balance</span>
                  <span className={clsx(
                    "text-sm font-black",
                    r.balance > 0 ? "text-danger" : "text-success"
                  )}>
                    {money(r.balance)}
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                {isArrival && canManageStays && (
                  <button
                    onClick={() => setCheckInReservation(r)}
                    className="btn-primary w-full shadow-md"
                  >
                    Check In Guest
                  </button>
                )}
                
                {(isDeparture || isInHouse) && (
                  <button
                    onClick={() => r.openFolioId ? setOpenFolio({ folioId: r.openFolioId, reservationId: r.id }) : setError("Folio missing.")}
                    className={clsx(
                      "w-full font-bold text-sm py-2.5 rounded-xl border transition-all duration-200",
                      isDeparture 
                        ? "bg-gold-500 text-white border-gold-600 hover:bg-gold-600 shadow-md active:scale-95" 
                        : "bg-white border-border text-navy-500 hover:bg-bg"
                    )}
                  >
                    {isDeparture ? "Check Out Now" : "View Folio"}
                  </button>
                )}

                {isInHouse && canManageStays && (
                  <button
                    onClick={() => { setError(null); setExtendReservation(r); }}
                    className="btn-teal w-full shadow-sm"
                  >
                    <Plus size={16} />
                    Add Days
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {activeList.length === 0 && (
          <div className="col-span-full card py-16 flex flex-col items-center justify-center border-dashed border-2 opacity-50 bg-transparent">
             <div className="p-4 rounded-full bg-bg mb-4">
                <EmptyIcon size={40} className="text-text-muted" />
             </div>
             <p className="font-bold text-text-primary">No guests found</p>
             <p className="text-sm text-text-secondary mt-1">There are no {getEmptyMessage()} scheduled.</p>
          </div>
        )}
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
