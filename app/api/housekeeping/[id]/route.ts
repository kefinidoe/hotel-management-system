import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROOM_STATUS_FOR: Record<string, string> = {
  NEEDS_CLEANING: "DIRTY",
  IN_PROGRESS: "CLEANING",
  READY_FOR_INSPECTION: "CLEANING",
  READY: "AVAILABLE",
};

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

   const forbidden = requireRole(session, ROLE_GROUPS.HOUSEKEEPING);
  if (forbidden) return forbidden;  
  const body = await req.json();
  const task = await prisma.housekeepingTask.update({
    where: { id },
    data: {
      status: body.status,
      assigneeId: body.assigneeId ?? undefined,
      priority: body.priority ?? undefined,
    },
  });

  if (body.status && ROOM_STATUS_FOR[body.status]) {
    await prisma.room.update({
      where: { id: task.roomId },
      data: { status: ROOM_STATUS_FOR[body.status] as any },
    });
  }

  return NextResponse.json(task);
}
