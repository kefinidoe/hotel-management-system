import { prisma } from "@/lib/prisma";
import { computeAvailablePortions } from "@/lib/inventory";
import RestaurantClient from "@/components/restaurant/RestaurantClient";

export const dynamic = "force-dynamic";

export default async function RestaurantPage() {
  const categories = await prisma.menuCategory.findMany({
    include: {
      items: {
        where: { isActive: true },
        include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const menu = categories.map((c) => ({
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
  }));

  return <RestaurantClient menu={menu} />;
}