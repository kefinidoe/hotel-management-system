import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { item: true },
  });
  if (!order) return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "This order has already been resolved." }, { status: 400 });
  }

  const before = Number(order.item.currentStock);
  const after = before + Number(order.quantity);

  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id: order.itemId }, data: { currentStock: after } }),
    prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `Received purchase order for ${order.quantity} ${order.item.unit} of ${order.item.name}`,
        entityType: "InventoryItem",
        entityId: order.itemId,
        before: { currentStock: before },
        after: { currentStock: after },
        reason: order.supplier ? `Supplier: ${order.supplier}` : null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
