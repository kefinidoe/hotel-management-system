import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.MAINTENANCE);
  if (forbidden) return forbidden;

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

  const forbidden = requireRole(session, ROLE_GROUPS.MAINTENANCE);
  if (forbidden) return forbidden;

  const body = await req.json();
  if (!body.title) {
    return NextResponse.json({ error: "A ticket title is required." }, { status: 400 });
  }

  const roomId = typeof body.roomId === "string" && body.roomId ? body.roomId : null;
  if (roomId) {
    const activeRoom = await prisma.room.findFirst({
      where: { id: roomId, isActive: true },
      select: { id: true },
    });
    if (!activeRoom) {
      return NextResponse.json(
        { error: "That room is no longer part of the active hotel inventory." },
        { status: 400 }
      );
    }
  }

  const ticket = await prisma.maintenanceTicket.create({
    data: {
      title: body.title,
      description: body.description || null,
      priority: body.priority || "normal",
      roomId,
      status: "OPEN",
    },
  });

  if (roomId && body.takeOutOfService) {
    await prisma.room.update({ where: { id: roomId }, data: { status: "MAINTENANCE" } });
  }

  return NextResponse.json(ticket, { status: 201 });
}
