import { prisma } from "@/lib/prisma";
import RestaurantClient from "@/components/restaurant/RestaurantClient";

export const dynamic = 'force-dynamic';

export default async function RestaurantPage() {
  const categories = await prisma.menuCategory.findMany({
    include: { items: { where: { isActive: true } } },
    orderBy: { name: "asc" },
  });

  const menu = categories.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((i) => ({ id: i.id, name: i.name, price: Number(i.price) })),
  }));

  return <RestaurantClient menu={menu} />;
}
