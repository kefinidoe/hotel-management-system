import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { newQuantity, reason } = await req.json();
  const qty = Number(newQuantity);
  if (!Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "Enter a valid counted quantity." }, { status: 400 });
  }
  if (!reason || !String(reason).trim()) {
    return NextResponse.json({ error: "A reason is required for a stock adjustment." }, { status: 400 });
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const before = Number(item.currentStock);

  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: qty } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `Adjusted stock of ${item.name}`,
        entityType: "InventoryItem",
        entityId: item.id,
        before: { currentStock: before },
        after: { currentStock: qty },
        reason: String(reason).trim(),
      },
    }),
  ]);

  return NextResponse.json({ currentStock: qty });
}
