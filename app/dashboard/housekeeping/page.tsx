import { prisma } from "@/lib/prisma";
import HousekeepingClient from "@/components/housekeeping/HousekeepingClient";

export const dynamic = 'force-dynamic';

export default async function HousekeepingPage() {
  const [tasks, staff] = await Promise.all([
    prisma.housekeepingTask.findMany({
      include: { room: { include: { roomType: true } }, assignee: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true } }),
  ]);

  const initialTasks = tasks.map((t) => ({
    id: t.id,
    status: t.status,
    priority: t.priority,
    roomId: t.roomId,
    roomNumber: t.room.number,
    roomTypeName: t.room.roomType.name,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
  }));

  return <HousekeepingClient initialTasks={initialTasks} staff={staff} />;
}
