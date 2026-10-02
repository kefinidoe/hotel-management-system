import type { Prisma } from "@prisma/client";
import { roundMoney } from "@/lib/billing";

export type CartLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type CartRequestLine = {
  menuItemId: string;
  quantity: number;
};

type TxClient = Prisma.TransactionClient;

const MAX_LINE_QUANTITY = 1000;

/**
 * Money rounding.
 *
 * This delegates to `roundMoney` in lib/billing.ts so the whole codebase rounds
 * money one way. It used to be a second, subtly different implementation
 * (`Math.round(value * 100) / 100`), which disagreed with `roundMoney` at exact
 * half-cent boundaries -- e.g. 1.005 came out as 1.00 here and 1.01 there.
 * Both write to the same `FolioItem.total` column, so a restaurant line and an
 * accommodation line on the same folio must not be rounded by different rules.
 *
 * Kept as a named export because the POS routes import it by this name.
 */
export const round2 = roundMoney;

// The browser is allowed to choose item IDs and quantities only. Item names
// and prices are deliberately ignored because client data can be modified.
export function readCartRequest(raw: unknown): CartRequestLine[] {
  if (!Array.isArray(raw)) return [];

  const quantities = new Map<string, number>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Every order line must contain a valid menu item and quantity.");
    }

    const value = entry as Record<string, unknown>;
    const menuItemId = typeof value.menuItemId === "string" ? value.menuItemId.trim() : "";
    const quantity = Number(value.quantity);

    if (!menuItemId) {
      throw new Error("Every order line must reference a menu item.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new Error(`Item quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}.`);
    }

    const combinedQuantity = (quantities.get(menuItemId) ?? 0) + quantity;
    if (combinedQuantity > MAX_LINE_QUANTITY) {
      throw new Error(`The combined quantity for one item cannot exceed ${MAX_LINE_QUANTITY}.`);
    }
    quantities.set(menuItemId, combinedQuantity);
  }

  return [...quantities.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

// Resolve the request to authoritative database names and prices inside the
// checkout transaction. This prevents forged requests from changing prices,
// billing a removed item, or deducting a different recipe from inventory.
export async function resolveCartLines(tx: TxClient, raw: unknown): Promise<CartLine[]> {
  const requested = readCartRequest(raw);
  if (requested.length === 0) return [];

  const items = await tx.menuItem.findMany({
    where: {
      id: { in: requested.map((line) => line.menuItemId) },
      isActive: true,
    },
    select: { id: true, name: true, price: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  return requested.map((line) => {
    const item = itemById.get(line.menuItemId);
    if (!item) {
      throw new Error("One or more menu items are unavailable. Refresh the menu and try again.");
    }

    const unitPrice = Number(item.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`The configured price for "${item.name}" is invalid.`);
    }

    return {
      menuItemId: item.id,
      name: item.name,
      unitPrice: round2(unitPrice),
      quantity: line.quantity,
    };
  });
}

export function cartSubtotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
}

export function cartTotal(lines: CartLine[]): number {
  // Axis Hotel selected no restaurant VAT for the current phase. When tax
  // configuration is added, the approved rate must come from server data.
  return cartSubtotal(lines);
}
