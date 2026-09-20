import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(
    items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.category,
      unit: i.unit,
      currentStock: Number(i.currentStock),
      reorderLevel: Number(i.reorderLevel),
      unitCost: i.unitCost ? Number(i.unitCost) : null,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { sku, name, category, unit, reorderLevel, unitCost, openingStock } = body;
  if (!sku || !name || !category || !unit) {
    return NextResponse.json({ error: "SKU, name, category and unit are required." }, { status: 400 });
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        sku,
        name,
        category,
        unit,
        reorderLevel: reorderLevel || 0,
        unitCost: unitCost || null,
        currentStock: openingStock || 0,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An item with that SKU already exists." }, { status: 400 });
  }
}
