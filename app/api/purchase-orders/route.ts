import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.purchaseOrder.findMany({
    include: { item: true },
    orderBy: { orderedAt: "desc" },
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      itemName: o.item.name,
      unit: o.item.unit,
      supplier: o.supplier,
      quantity: Number(o.quantity),
      unitCost: o.unitCost ? Number(o.unitCost) : null,
      status: o.status,
      orderedAt: o.orderedAt.toISOString(),
      receivedAt: o.receivedAt?.toISOString() ?? null,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemId, supplier, quantity, unitCost } = body;
  const qty = Number(quantity);

  if (!itemId) return NextResponse.json({ error: "Choose an item to order." }, { status: 400 });
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Enter a quantity greater than zero." }, { status: 400 });
  }

  const order = await prisma.purchaseOrder.create({
    data: {
      itemId,
      supplier: supplier || null,
      quantity: qty,
      unitCost: unitCost ? Number(unitCost) : null,
      status: "PENDING",
    },
  });
  return NextResponse.json({ id: order.id }, { status: 201 });
}
