import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const purchases = await prisma.purchase.findMany({
    include: { inventoryItem: true, createdBy: true },
    orderBy: { purchaseDate: "desc" },
    take: 100,
  });

  return NextResponse.json(
    purchases.map((p) => ({
      id: p.id,
      itemName: p.inventoryItem.name,
      unit: p.inventoryItem.unit,
      supplier: p.supplier,
      invoiceNumber: p.invoiceNumber,
      quantity: Number(p.quantity),
      unitCost: Number(p.unitCost),
      totalCost: Number(p.totalCost),
      purchaseDate: p.purchaseDate,
      createdByName: p.createdBy.name,
    }))
  );
}

// Recording a purchase increases stock and logs a StockMovement, atomically.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { inventoryItemId, supplier, invoiceNumber, quantity, unitCost, purchaseDate } = body as {
    inventoryItemId: string;
    supplier: string;
    invoiceNumber?: string;
    quantity: number;
    unitCost: number;
    purchaseDate?: string;
  };

  if (!inventoryItemId || !supplier || !quantity || quantity <= 0 || unitCost === undefined) {
    return NextResponse.json(
      { error: "Item, supplier, quantity, and unit cost are required." },
      { status: 400 }
    );
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item) return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });

  const before = Number(item.currentStock);
  const after = before + Number(quantity);
  const totalCost = Number(quantity) * Number(unitCost);

  const [purchase] = await prisma.$transaction([
    prisma.purchase.create({
      data: {
        inventoryItemId,
        supplier,
        invoiceNumber: invoiceNumber || null,
        quantity,
        unitCost,
        totalCost,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        createdById: auth.user.id,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: after, costPerUnit: unitCost },
    }),
    prisma.stockMovement.create({
      data: {
        inventoryItemId,
        type: "PURCHASE",
        quantity,
        beforeQty: before,
        afterQty: after,
        reference: invoiceNumber ? `Invoice ${invoiceNumber}` : `Purchase from ${supplier}`,
        userId: auth.user.id,
      },
    }),
  ]);

  return NextResponse.json(purchase, { status: 201 });
}