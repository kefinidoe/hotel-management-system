import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    prisma.room.count(),
    prisma.room.count({ where: { status: "OCCUPIED" } }),
    prisma.room.count({ where: { status: "AVAILABLE" } }),
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
    { label: "Occupancy", value: `${occupancyPct}%`, sub: `${occupiedRooms} of ${totalRooms} rooms occupied` },
    { label: "Today's Revenue", value: `KSh ${todaysRevenue.toLocaleString()}`, sub: "Payments received today" },
    { label: "Available Rooms", value: String(availableRooms), sub: `of ${totalRooms} total` },
    { label: "Arrivals", value: String(arrivalsToday), sub: "expected today" },
    { label: "Departures", value: String(departuresToday), sub: "expected today" },
    { label: "Outstanding Balance", value: `KSh ${outstandingBalance.toLocaleString()}`, sub: "across all unpaid folios" },
  ];

  return (
    <div>
      <h1>Good day, {firstName}</h1>
      <p className="text-text-secondary text-sm mt-1">
        Here's what's happening at your hotel today.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card">
            <p className="text-sm text-text-secondary">{kpi.label}</p>
            <p className="kpi-value mt-1">{kpi.value}</p>
            <p className="text-xs text-text-muted mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {totalRooms === 0 && (
        <div className="card mt-6">
          <p className="text-sm text-text-secondary">
            No rooms yet — head to the <strong>Rooms</strong> page in the sidebar to add your
            hotel's rooms and room types, then create reservations from the{" "}
            <strong>Reservations</strong> calendar.
          </p>
        </div>
      )}
    </div>
  );
}
