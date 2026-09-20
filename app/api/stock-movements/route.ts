import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");

  const movements = await prisma.stockMovement.findMany({
    where: itemId ? { inventoryItemId: itemId } : undefined,
    include: { inventoryItem: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    movements.map((m) => ({
      id: m.id,
      itemName: m.inventoryItem.name,
      unit: m.inventoryItem.unit,
      type: m.type,
      quantity: Number(m.quantity),
      beforeQty: Number(m.beforeQty),
      afterQty: Number(m.afterQty),
      reference: m.reference,
      userName: m.user?.name ?? "System",
      createdAt: m.createdAt,
    }))
  );
}