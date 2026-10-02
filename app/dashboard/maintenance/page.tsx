import { prisma } from "@/lib/prisma";
import MaintenanceClient from "@/components/maintenance/MaintenanceClient";
import { requirePageRole } from "@/lib/page-auth";
import { ROLE_GROUPS } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  await requirePageRole(ROLE_GROUPS.MAINTENANCE);

  const [tickets, rooms, staff] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      include: { room: true, assignee: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { number: "asc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true } }),
  ]);

  const initialTickets = tickets.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    cost: t.cost ? Number(t.cost) : null,
    roomId: t.roomId,
    roomNumber: t.room?.number ?? null,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
  }));

  return (
    <MaintenanceClient
      initialTickets={initialTickets}
      rooms={rooms.map((r) => ({ id: r.id, number: r.number }))}
      staff={staff}
    />
  );
}
