export type CartLine = {
  menuItemId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function readCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];

  const lines: CartLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const name = typeof e.name === "string" ? e.name.trim() : "";
    const unitPrice = Number(e.unitPrice);
    const quantity = Math.floor(Number(e.quantity));

    if (!name) continue;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
    if (!Number.isFinite(quantity) || quantity < 1) continue;

    lines.push({
      menuItemId: typeof e.menuItemId === "string" ? e.menuItemId : null,
      name,
      unitPrice: round2(unitPrice),
      quantity,
    });
  }
  return lines;
}

export function cartSubtotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
}

export function cartTotal(lines: CartLine[], vatRate = 0): number {
  const vat = Number.isFinite(vatRate) ? vatRate : 0;
  return round2(cartSubtotal(lines) * (1 + vat / 100));
}