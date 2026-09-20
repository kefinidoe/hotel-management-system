import { prisma } from "@/lib/prisma";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const [items, orders] = await Promise.all([
    prisma.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    prisma.purchaseOrder.findMany({
      where: { status: "PENDING" },
      include: { item: true },
      orderBy: { orderedAt: "desc" },
    }),
  ]);

  const initialItems = items.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    category: i.category,
    unit: i.unit,
    currentStock: Number(i.currentStock),
    reorderLevel: Number(i.reorderLevel),
    unitCost: i.unitCost ? Number(i.unitCost) : null,
  }));

  const pendingOrders = orders.map((o) => ({
    id: o.id,
    itemName: o.item.name,
    unit: o.item.unit,
    supplier: o.supplier,
    quantity: Number(o.quantity),
    orderedAt: o.orderedAt.toISOString(),
  }));

  return <InventoryClient initialItems={initialItems} pendingOrders={pendingOrders} />;
}
