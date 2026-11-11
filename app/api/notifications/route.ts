import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(notifications);
}

export async function PATCH(req: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id, all } = await req.json();

  if (all) {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  } else if (id) {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ ok: true });
}
