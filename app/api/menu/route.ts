import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { computeAvailablePortions } from "@/lib/inventory";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const categories = await prisma.menuCategory.findMany({
    include: {
      items: {
        where: { isActive: true },
        include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
      },
    },
  });

  return NextResponse.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((i) => {
        if (!i.recipe) {
          // No recipe defined yet for this item -- treat as always available.
          return { id: i.id, name: i.name, price: Number(i.price), availablePortions: null };
        }
        const ingredients = i.recipe.ingredients.map((ri) => ({
          inventoryItemId: ri.inventoryItemId,
          name: ri.inventoryItem.name,
          unit: ri.inventoryItem.unit,
          quantityPerBatch: Number(ri.quantity),
          currentStock: Number(ri.inventoryItem.currentStock),
        }));
        const { portions } = computeAvailablePortions(ingredients, i.recipe.portions);
        return { id: i.id, name: i.name, price: Number(i.price), availablePortions: portions };
      }),
    }))
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = Number(body.price);
  const categoryId = body.categoryId;

  if (!name) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Choose a category." }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: { name, price, categoryId },
  });
  return NextResponse.json({ id: item.id }, { status: 201 });
}