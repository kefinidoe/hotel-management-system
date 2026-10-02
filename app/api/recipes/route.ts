import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { computeAvailablePortions } from "@/lib/inventory";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const recipes = await prisma.recipe.findMany({
    include: {
      menuItem: { include: { category: true } },
      ingredients: { include: { inventoryItem: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = recipes.map((r) => {
    const ingredients = r.ingredients.map((ri) => ({
      inventoryItemId: ri.inventoryItemId,
      name: ri.inventoryItem.name,
      unit: ri.inventoryItem.unit,
      quantityPerBatch: Number(ri.quantity),
      currentStock: Number(ri.inventoryItem.currentStock),
      unitCost: Number(ri.inventoryItem.costPerUnit),
    }));

    const { portions, limitingItem } = computeAvailablePortions(ingredients, r.portions);

    const costPerBatch = ingredients.reduce((s, i) => s + i.quantityPerBatch * i.unitCost, 0);
    const costPerPortion = costPerBatch / r.portions;
    const sellingPrice = Number(r.menuItem.price);
    const profit = sellingPrice - costPerPortion;

    return {
      id: r.id,
      menuItemId: r.menuItemId,
      name: r.menuItem.name,
      category: r.menuItem.category.name,
      sellingPrice,
      portionsPerBatch: r.portions,
      costPerPortion: Math.round(costPerPortion),
      profit: Math.round(profit),
      profitMargin: sellingPrice > 0 ? Math.round((profit / sellingPrice) * 100) : 0,
      availablePortions: portions,
      limitingItem,
      ingredients: ingredients.map((i) => ({
        inventoryItemId: i.inventoryItemId,
        name: i.name,
        unit: i.unit,
        quantityPerBatch: i.quantityPerBatch,
      })),
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { menuItemId, portions, ingredients } = body as {
    menuItemId: string;
    portions: number;
    ingredients: { inventoryItemId: string; quantity: number }[];
  };

  if (!menuItemId || !ingredients || ingredients.length === 0) {
    return NextResponse.json(
      { error: "A menu item, portion count, and at least one ingredient are required." },
      { status: 400 }
    );
  }

  // `RecipeIngredient.quantity` is Decimal(10,2) with no CHECK constraint, and
  // `computeAvailablePortions()` divides each ingredient by `portions`. A zero,
  // negative or non-numeric value therefore poisons every availability
  // calculation that reads this recipe: the dish shows as completely
  // unavailable and the broken line gets named to staff as the bottleneck.
  // `lib/inventory.ts` defends against this at read time, but rejecting it here
  // keeps the bad data out of the database in the first place.
  const portionCount = Number(portions);
  if (!Number.isInteger(portionCount) || portionCount < 1) {
    return NextResponse.json(
      { error: "The portion count must be a whole number of at least 1." },
      { status: 400 }
    );
  }

  for (const ingredient of ingredients) {
    const quantity = Number(ingredient?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Every ingredient needs a quantity greater than zero." },
        { status: 400 }
      );
    }
  }

  try {
    const recipe = await prisma.recipe.create({
      data: {
        menuItemId,
        portions: portionCount,
        ingredients: {
          create: ingredients.map((i) => ({
            inventoryItemId: i.inventoryItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: { ingredients: true },
    });
    return NextResponse.json(recipe, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "That menu item already has a recipe, or an ingredient is invalid." },
      { status: 400 }
    );
  }
}