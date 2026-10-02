import { prisma } from "@/lib/prisma";
import { computeAvailablePortions } from "@/lib/inventory";
import RestaurantClient from "@/components/restaurant/RestaurantClient";
import { requirePageRole } from "@/lib/page-auth";
import { ROLE_GROUPS } from "@/lib/permissions";
import { sortMenuCategories } from "@/lib/menu-categories";
import { getRestaurantDashboardData } from "@/lib/restaurant-dashboard";

export const dynamic = "force-dynamic";

export default async function RestaurantPage() {
  const session = await requirePageRole(ROLE_GROUPS.RESTAURANT_POS);

  const [categories, dashboardData] = await Promise.all([
    prisma.menuCategory.findMany({
      relationLoadStrategy: "join",
      select: {
        id: true,
        name: true,
        items: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            recipe: {
              select: {
                portions: true,
                ingredients: {
                  select: {
                    inventoryItemId: true,
                    quantity: true,
                    inventoryItem: {
                      select: { name: true, unit: true, currentStock: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getRestaurantDashboardData(),
  ]);

  const menu = sortMenuCategories(categories).map((c) => ({
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

  return (
    <RestaurantClient
      menu={menu}
      currentUserRole={session.user.role}
      initialFolios={dashboardData.folios}
      initialMethods={dashboardData.paymentMethods}
      initialActivity={dashboardData.activity}
      initialTodayTotal={dashboardData.todayTotal}
    />
  );
}