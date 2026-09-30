import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.HOUSEKEEPING);
  if (forbidden) return forbidden;

  const tasks = await prisma.housekeepingTask.findMany({
    include: { room: { include: { roomType: true } }, assignee: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    tasks.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      roomId: t.roomId,
      roomNumber: t.room.number,
      roomTypeName: t.room.roomType.name,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee?.name ?? null,
      updatedAt: t.updatedAt.toISOString(),
    }))
  );
}