import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

   const forbidden = requireRole(session, ROLE_GROUPS.MAINTENANCE);
  if (forbidden) return forbidden;  

  const body = await req.json();
  const ticket = await prisma.maintenanceTicket.update({
    where: { id: params.id },
    data: {
      status: body.status ?? undefined,
      assigneeId: body.assigneeId ?? undefined,
      priority: body.priority ?? undefined,
      description: body.description ?? undefined,
      cost: body.cost !== undefined ? body.cost : undefined,
    },
  });

  if (body.status === "COMPLETED" && ticket.roomId) {
    await prisma.room.update({ where: { id: ticket.roomId }, data: { status: "AVAILABLE" } });
  }

  return NextResponse.json(ticket);
}
