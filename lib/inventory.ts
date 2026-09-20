// Shared inventory logic used by both API routes and dashboard pages.
// Every InventoryItem is tracked internally in ONE base unit (g, ml, or pcs)
// so the recipe engine never has to guess at a conversion. These helpers
// only handle turning that base-unit number into something readable.

import type { Prisma } from "@prisma/client";
import type { CartLine } from "@/lib/restaurant";

export type BaseUnit = "g" | "ml" | "pcs";

/** Human-friendly display of a base-unit quantity, e.g. 2000 "g" -> "2.0 kg". */
export function formatQty(quantity: number, unit: string): string {
  const n = Number(quantity);
  if (unit === "g") {
    return n >= 1000 ? `${(n / 1000).toFixed(2)} kg` : `${n.toFixed(0)} g`;
  }
  if (unit === "ml") {
    return n >= 1000 ? `${(n / 1000).toFixed(2)} L` : `${n.toFixed(0)} ml`;
  }
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} pcs`;
}

export type StockStatus = "OUT_OF_STOCK" | "CRITICAL" | "LOW_STOCK" | "IN_STOCK";

/** Critical = below half the reorder level; Low = at/below reorder level. */
export function getStockStatus(currentStock: number, reorderLevel: number): StockStatus {
  if (currentStock <= 0) return "OUT_OF_STOCK";
  if (reorderLevel > 0 && currentStock <= reorderLevel / 2) return "CRITICAL";
  if (reorderLevel > 0 && currentStock <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  OUT_OF_STOCK: "Out of Stock",
  CRITICAL: "Critical",
  LOW_STOCK: "Low Stock",
  IN_STOCK: "In Stock",
};

export const STOCK_STATUS_BADGE_CLASS: Record<StockStatus, string> = {
  OUT_OF_STOCK: "badge bg-text-primary/10 text-text-secondary",
  CRITICAL: "badge bg-danger/10 text-danger",
  LOW_STOCK: "badge bg-warning/10 text-warning",
  IN_STOCK: "badge bg-success/10 text-success",
};

export type IngredientLine = {
  inventoryItemId: string;
  name: string;
  unit: string;
  quantityPerBatch: number; // quantity required for `portions` portions
  currentStock: number;
};

/**
 * Recipe Availability Engine: given a recipe's ingredient list and the
 * portions that quantity list makes, work out how many whole portions can
 * currently be prepared, and which ingredient is the bottleneck.
 */
export function computeAvailablePortions(
  ingredients: IngredientLine[],
  portionsPerBatch: number
): { portions: number; limitingItem: string | null } {
  if (ingredients.length === 0) return { portions: 0, limitingItem: null };

  let minPortions = Infinity;
  let limitingItem: string | null = null;

  for (const ing of ingredients) {
    if (ing.quantityPerBatch <= 0) continue;
    const perPortion = ing.quantityPerBatch / portionsPerBatch;
    const possible = Math.floor(ing.currentStock / perPortion);
    if (possible < minPortions) {
      minPortions = possible;
      limitingItem = ing.name;
    }
  }

  if (!isFinite(minPortions)) return { portions: 0, limitingItem: null };
  return { portions: Math.max(0, minPortions), limitingItem };
}

type TxClient = Prisma.TransactionClient;

/**
 * Deducts recipe ingredients for every cart line whose menu item has a
 * recipe attached. Items with no recipe are skipped -- treated as always
 * available (e.g. a bottled drink you haven't linked to inventory yet).
 *
 * Must be called INSIDE the same transaction as the folio/payment writes:
 * if stock is insufficient, this throws and the whole order rolls back
 * together -- never a paid order with no stock deducted, or a deduction
 * with no matching sale.
 */
export async function deductRecipeStock(
  tx: TxClient,
  lines: CartLine[],
  reference: string,
  userId: string
): Promise<void> {
  const needed = new Map<string, number>(); // inventoryItemId -> base-unit quantity needed

  for (const line of lines) {
    if (!line.menuItemId) continue;
    const recipe = await tx.recipe.findUnique({
      where: { menuItemId: line.menuItemId },
      include: { ingredients: true },
    });
    if (!recipe) continue; // no recipe defined for this item -- nothing to deduct

    for (const ing of recipe.ingredients) {
      const perPortion = Number(ing.quantity) / recipe.portions;
      const total = perPortion * line.quantity;
      needed.set(ing.inventoryItemId, (needed.get(ing.inventoryItemId) ?? 0) + total);
    }
  }

  if (needed.size === 0) return;

  const items = await tx.inventoryItem.findMany({ where: { id: { in: [...needed.keys()] } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Check everything first, before writing anything.
  for (const [itemId, qty] of needed) {
    const item = itemById.get(itemId);
    if (!item) throw new Error("An ingredient used by this order no longer exists in inventory.");
    if (Number(item.currentStock) < qty) {
      throw new Error(
        `Not enough "${item.name}" in stock to complete this order (need ${qty.toFixed(1)} ${item.unit}, have ${Number(item.currentStock).toFixed(1)} ${item.unit}).`
      );
    }
  }

  // Now apply.
  for (const [itemId, qty] of needed) {
    const item = itemById.get(itemId)!;
    const before = Number(item.currentStock);
    const after = before - qty;

    await tx.inventoryItem.update({ where: { id: itemId }, data: { currentStock: after } });
    await tx.stockMovement.create({
      data: {
        inventoryItemId: itemId,
        type: "MEAL_SALE",
        quantity: -qty,
        beforeQty: before,
        afterQty: after,
        reference,
        userId,
      },
    });
  }
}