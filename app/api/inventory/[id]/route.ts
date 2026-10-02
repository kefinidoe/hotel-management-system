import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      stockMovements: { orderBy: { createdAt: "desc" }, take: 50, include: { user: true } },
      recipeIngredients: { include: { recipe: { include: { menuItem: true } } } },
    },
  });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  return NextResponse.json({
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    currentStock: Number(item.currentStock),
    reorderLevel: Number(item.reorderLevel),
    costPerUnit: Number(item.costPerUnit),
    supplier: item.supplier,
    isActive: item.isActive,
    stockMovements: item.stockMovements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: Number(m.quantity),
      beforeQty: Number(m.beforeQty),
      afterQty: Number(m.afterQty),
      reference: m.reference,
      userName: m.user?.name ?? null,
      createdAt: m.createdAt,
    })),
    usedIn: item.recipeIngredients.map((ri) => ({
      menuItemName: ri.recipe.menuItem.name,
      quantity: Number(ri.quantity),
      portions: ri.recipe.portions,
    })),
  });
}

// Handles both editing basic fields and a manual stock adjustment
// (pass `newQuantity` + `reason` to trigger an adjustment + audit trail).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  if (body.newQuantity !== undefined) {
    const before = Number(item.currentStock);
    const after = Number(body.newQuantity);
    const delta = after - before;

    const [, movement] = await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: after } }),
      prisma.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "ADJUSTMENT",
          quantity: delta,
          beforeQty: before,
          afterQty: after,
          reference: body.reason || "Manual adjustment",
          userId: auth.user.id,
        },
      }),
    ]);
    return NextResponse.json({ ok: true, movement });
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      name: body.name ?? undefined,
      category: body.category ?? undefined,
      reorderLevel: body.reorderLevel ?? undefined,
      costPerUnit: body.costPerUnit ?? undefined,
      supplier: body.supplier ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

// Delete or deactivate, depending on whether real history exists.
// A never-used item (no purchases, wastage, stock movements, or recipe
// links) is genuinely deleted -- nothing to protect. Anything with real
// history is deactivated instead: hidden from the active list, but every
// past purchase/wastage/movement record that points at it stays intact
// and still makes sense.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const [purchaseCount, wastageCount, movementCount, recipeCount] = await Promise.all([
    prisma.purchase.count({ where: { inventoryItemId: id } }),
    prisma.wastage.count({ where: { inventoryItemId: id } }),
    prisma.stockMovement.count({ where: { inventoryItemId: id } }),
    prisma.recipeIngredient.count({ where: { inventoryItemId: id } }),
  ]);

  const hasHistory = purchaseCount > 0 || wastageCount > 0 || movementCount > 0 || recipeCount > 0;

  if (!hasHistory) {
    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ mode: "deleted" });
  }

  await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ mode: "deactivated" });
}