import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { getStockStatus } from "@/lib/inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const items = await prisma.inventoryItem.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    items.map((i) => {
      const currentStock = Number(i.currentStock);
      const reorderLevel = Number(i.reorderLevel);
      const costPerUnit = Number(i.costPerUnit);
      return {
        id: i.id,
        sku: i.sku,
        name: i.name,
        category: i.category,
        unit: i.unit,
        currentStock,
        reorderLevel,
        costPerUnit,
        supplier: i.supplier,
        isActive: i.isActive,
        stockValue: Math.round(currentStock * costPerUnit),
        status: getStockStatus(currentStock, reorderLevel),
      };
    })
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { sku, name, category, unit, currentStock, reorderLevel, costPerUnit, supplier } = body;

  if (!sku || !name || !category || !unit) {
    return NextResponse.json(
      { error: "SKU, name, category, and unit are required." },
      { status: 400 }
    );
  }
  if (!["g", "ml", "pcs"].includes(unit)) {
    return NextResponse.json({ error: "Unit must be g, ml, or pcs." }, { status: 400 });
  }

  const opening = Number(currentStock) || 0;

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          sku,
          name,
          category,
          unit,
          currentStock: opening,
          reorderLevel: reorderLevel ?? 0,
          costPerUnit: costPerUnit ?? 0,
          supplier: supplier || null,
        },
      });

      if (opening > 0) {
        await tx.stockMovement.create({
          data: {
            inventoryItemId: created.id,
            type: "OPENING_BALANCE",
            quantity: opening,
            beforeQty: 0,
            afterQty: opening,
            reference: "Item created",
            userId: auth.user.id,
          },
        });
      }

      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An item with that SKU already exists." }, { status: 400 });
  }
}