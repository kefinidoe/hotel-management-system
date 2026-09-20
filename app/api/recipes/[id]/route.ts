import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { portions, ingredients } = body as {
    portions?: number;
    ingredients?: { inventoryItemId: string; quantity: number }[];
  };

  const recipe = await prisma.recipe.findUnique({ where: { id: params.id } });
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    if (ingredients) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
      await tx.recipeIngredient.createMany({
        data: ingredients.map((i) => ({
          recipeId: recipe.id,
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity,
        })),
      });
    }

    return tx.recipe.update({
      where: { id: recipe.id },
      data: { portions: portions ?? undefined },
      include: { ingredients: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  await prisma.recipe.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}