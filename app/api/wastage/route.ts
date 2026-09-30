import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const wastages = await prisma.wastage.findMany({
    include: { inventoryItem: true, recordedBy: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    wastages.map((w) => ({
      id: w.id,
      itemName: w.inventoryItem.name,
      unit: w.inventoryItem.unit,
      quantity: Number(w.quantity),
      reason: w.reason,
      department: w.department,
      recordedByName: w.recordedBy.name,
      createdAt: w.createdAt,
      value: Math.round(Number(w.quantity) * Number(w.inventoryItem.costPerUnit)),
    }))
  );
}

// Recording wastage decreases stock and logs a StockMovement, atomically.
// Wastage can't exceed what's actually on the shelf -- if it looks like it
// does, that means the stock count is wrong somewhere upstream, and silently
// clamping to zero would hide that instead of surfacing it.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { inventoryItemId, quantity, reason, department } = body as {
    inventoryItemId: string;
    quantity: number;
    reason: string;
    department?: string;
  };

  if (!inventoryItemId || !quantity || quantity <= 0 || !reason) {
    return NextResponse.json(
      { error: "Item, quantity, and reason are required." },
      { status: 400 }
    );
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item) return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });

  const before = Number(item.currentStock);
  if (Number(quantity) > before) {
    return NextResponse.json(
      {
        error: `Only ${before} ${item.unit} of "${item.name}" in stock — can't log wastage of ${quantity}. If the physical count is actually lower, use Adjust Stock instead.`,
      },
      { status: 400 }
    );
  }
  const after = before - Number(quantity);

  const [wastage] = await prisma.$transaction([
    prisma.wastage.create({
      data: {
        inventoryItemId,
        quantity,
        reason: reason as any,
        department: department || null,
        recordedById: auth.user.id,
      },
    }),
    prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: after } }),
    prisma.stockMovement.create({
      data: {
        inventoryItemId,
        type: "WASTAGE",
        quantity: -Number(quantity),
        beforeQty: before,
        afterQty: after,
        reference: `Wastage: ${reason}`,
        userId: auth.user.id,
      },
    }),
  ]);

  return NextResponse.json(wastage, { status: 201 });
}