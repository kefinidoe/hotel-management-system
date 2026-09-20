import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quantity, note } = await req.json();
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Enter a quantity greater than zero." }, { status: 400 });
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const before = Number(item.currentStock);
  const after = before + qty;

  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: after } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `Received ${qty} ${item.unit} of ${item.name}`,
        entityType: "InventoryItem",
        entityId: item.id,
        before: { currentStock: before },
        after: { currentStock: after },
        reason: note || null,
      },
    }),
  ]);

  return NextResponse.json({ currentStock: after });
}
