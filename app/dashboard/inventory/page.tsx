import { prisma } from "@/lib/prisma";
import { getStockStatus } from "@/lib/inventory";
import InventoryClient from "@/components/inventory/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [items, todaysMovements, todaysPurchases] = await Promise.all([
    prisma.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: startOfToday }, type: { in: ["MEAL_SALE", "WASTAGE"] } },
      include: { inventoryItem: true },
    }),
    prisma.purchase.findMany({ where: { purchaseDate: { gte: startOfToday } } }),
  ]);

  const initialItems = items.map((i) => {
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
      stockValue: Math.round(currentStock * costPerUnit),
      status: getStockStatus(currentStock, reorderLevel),
    };
  });

  const todaysConsumption = Math.round(
    todaysMovements.reduce(
      (sum, m) => sum + Math.abs(Number(m.quantity)) * Number(m.inventoryItem.costPerUnit),
      0
    )
  );
  const todaysPurchasesValue = Math.round(
    todaysPurchases.reduce((sum, p) => sum + Number(p.totalCost), 0)
  );

  const kpis = {
    totalItems: initialItems.length,
    totalValue: initialItems.reduce((s, i) => s + i.stockValue, 0),
    lowStock: initialItems.filter((i) => i.status === "LOW_STOCK" || i.status === "CRITICAL").length,
    outOfStock: initialItems.filter((i) => i.status === "OUT_OF_STOCK").length,
    todaysConsumption,
    todaysPurchases: todaysPurchasesValue,
  };

  return <InventoryClient initialItems={initialItems} kpis={kpis} />;
}