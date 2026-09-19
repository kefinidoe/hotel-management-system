import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tickets = await prisma.maintenanceTicket.findMany({
    include: { room: true, assignee: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    tickets.map((t) => ({
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
      updatedAt: t.updatedAt.toISOString(),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.title) {
    return NextResponse.json({ error: "A ticket title is required." }, { status: 400 });
  }

  const ticket = await prisma.maintenanceTicket.create({
    data: {
      title: body.title,
      description: body.description || null,
      priority: body.priority || "normal",
      roomId: body.roomId || null,
      status: "OPEN",
    },
  });

  if (body.roomId && body.takeOutOfService) {
    await prisma.room.update({ where: { id: body.roomId }, data: { status: "MAINTENANCE" } });
  }

  return NextResponse.json(ticket, { status: 201 });
}
