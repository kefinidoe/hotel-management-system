import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { 
  Users, 
  BedDouble, 
  TrendingUp, 
  LogOut as DepartureIcon, 
  LogIn as ArrivalIcon, 
  Wallet 
} from "lucide-react";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    totalRooms,
    occupiedRooms,
    availableRooms,
    arrivalsToday,
    departuresToday,
    revenueAgg,
    allItemsAgg,
    allPaymentsAgg,
  ] = await Promise.all([
    prisma.room.count({ where: { isActive: true } }),
    prisma.room.count({ where: { isActive: true, status: "OCCUPIED" } }),
    prisma.room.count({ where: { isActive: true, status: "AVAILABLE" } }),
    prisma.reservation.count({
      where: { checkInDate: { gte: todayStart, lt: todayEnd }, status: { in: ["CONFIRMED", "PENDING"] } },
    }),
    prisma.reservation.count({
      where: { checkOutDate: { gte: todayStart, lt: todayEnd }, status: "CHECKED_IN" },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: todayStart, lt: todayEnd }, status: "COMPLETED" },
    }),
    prisma.folioItem.aggregate({ _sum: { total: true } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
  ]);

  const todaysRevenue = Number(revenueAgg._sum.amount ?? 0);
  const outstandingBalance = Math.max(
    0,
    Number(allItemsAgg._sum.total ?? 0) - Number(allPaymentsAgg._sum.amount ?? 0)
  );
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const kpis = [
    { 
      label: "Occupancy", 
      value: `${occupancyPct}%`, 
      sub: `${occupiedRooms} of ${totalRooms} rooms occupied`,
      icon: Users,
      color: "text-navy-500",
      bg: "bg-navy-50"
    },
    { 
      label: "Today's Revenue", 
      value: `KSh ${todaysRevenue.toLocaleString()}`, 
      sub: "Payments received today",
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success-bg"
    },
    { 
      label: "Available Rooms", 
      value: String(availableRooms), 
      sub: `of ${totalRooms} total rooms`,
      icon: BedDouble,
      color: "text-info",
      bg: "bg-info-bg"
    },
    { 
      label: "Expected Arrivals", 
      value: String(arrivalsToday), 
      sub: "Guests checking in today",
      icon: ArrivalIcon,
      color: "text-teal-600",
      bg: "bg-teal-50"
    },
    { 
      label: "Expected Departures", 
      value: String(departuresToday), 
      sub: "Guests checking out today",
      icon: DepartureIcon,
      color: "text-gold-600",
      bg: "bg-gold-50"
    },
    { 
      label: "Outstanding Balance", 
      value: `KSh ${outstandingBalance.toLocaleString()}`, 
      sub: "Total guest debt on folios",
      icon: Wallet,
      color: "text-danger",
      bg: "bg-danger-bg"
    },
  ];

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy-500">Good day, {firstName}</h1>
        <p className="text-text-secondary mt-1">
          Here is a summary of the Axis Hotel activity for today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card group hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 border-border/60">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div className="bg-bg rounded-full px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border border-border">
                  Daily
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-[0.1em]">{kpi.label}</p>
                <p className={`text-2xl font-bold tracking-tight mt-1 ${kpi.color === 'text-navy-500' ? 'text-navy-500' : kpi.color}`}>
                  {kpi.value}
                </p>
                <p className="text-xs text-text-secondary mt-1 font-medium italic opacity-80">{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {totalRooms === 0 && (
        <div className="card mt-8 bg-gold-50 border-gold-200">
          <p className="text-sm text-gold-900 font-medium">
            Welcome to your new system! No rooms have been added yet. Head to the 
            <strong className="mx-1 underline text-gold-950 italic">Rooms</strong> 
            page to set up your hotel inventory.
          </p>
        </div>
      )}
      
      {/* Visual placeholder for activity chart or quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
         <div className="card border-dashed border-2 flex flex-col items-center justify-center py-12 opacity-40 grayscale pointer-events-none">
            <TrendingUp size={48} className="text-navy-500 mb-4" />
            <p className="font-bold text-navy-500">Revenue Analytics</p>
            <p className="text-xs">Data population in progress...</p>
         </div>
         <div className="card border-dashed border-2 flex flex-col items-center justify-center py-12 opacity-40 grayscale pointer-events-none">
            <Users size={48} className="text-navy-500 mb-4" />
            <p className="font-bold text-navy-500">Live Occupancy</p>
            <p className="text-xs">Real-time floor map loading...</p>
         </div>
      </div>
    </div>
  );
}
