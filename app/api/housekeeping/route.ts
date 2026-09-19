import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
