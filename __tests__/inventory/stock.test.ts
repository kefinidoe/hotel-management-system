import { describe, it, expect } from "vitest";
import {
  formatQty,
  getStockStatus,
  computeAvailablePortions,
  type IngredientLine,
} from "../../lib/inventory";

/**
 * The inventory display and availability logic.
 *
 * `computeAvailablePortions` is the one that matters: it decides what the POS
 * will let staff sell. If it over-counts, a waiter takes an order the kitchen
 * cannot fill; if it under-counts, sellable food looks unavailable. The
 * subtly wrong cases are things like a recipe with a zero/negative quantity
 * line, an ingredient with no stock, and the choice of *which* ingredient is
 * reported as the bottleneck (that's what staff get told to restock).
 */

const ing = (
  name: string,
  quantityPerBatch: number,
  currentStock: number,
  unit = "g"
): IngredientLine => ({ inventoryItemId: name, name, unit, quantityPerBatch, currentStock });

describe("formatQty", () => {
  it("switches to kg at 1000 g and to L at 1000 ml", () => {
    expect(formatQty(999, "g")).toBe("999 g");
    expect(formatQty(1000, "g")).toBe("1.00 kg");
    expect(formatQty(2500, "g")).toBe("2.50 kg");
    expect(formatQty(999, "ml")).toBe("999 ml");
    expect(formatQty(1000, "ml")).toBe("1.00 L");
  });

  it("shows whole pieces without decimals and fractions with two", () => {
    expect(formatQty(3, "pcs")).toBe("3 pcs");
    expect(formatQty(1.5, "pcs")).toBe("1.50 pcs");
  });

  it("falls back to pcs for an unknown unit", () => {
    // The DB column is a free string, so anything unrecognised lands here.
    expect(formatQty(2, "bottles")).toBe("2 pcs");
    expect(formatQty(2, "")).toBe("2 pcs");
  });

  it("accepts numeric strings and Decimals from Prisma", () => {
    expect(formatQty("2000" as unknown as number, "g")).toBe("2.00 kg");
    expect(formatQty({ toString: () => "1500" } as unknown as number, "g")).toBe("1.50 kg");
  });
});

describe("getStockStatus", () => {
  it("is OUT_OF_STOCK at or below zero", () => {
    expect(getStockStatus(0, 100)).toBe("OUT_OF_STOCK");
    expect(getStockStatus(-5, 100)).toBe("OUT_OF_STOCK");
  });

  it("is CRITICAL at or below half the reorder level", () => {
    expect(getStockStatus(50, 100)).toBe("CRITICAL");
    expect(getStockStatus(1, 100)).toBe("CRITICAL");
  });

  it("is LOW_STOCK at or below the reorder level", () => {
    expect(getStockStatus(51, 100)).toBe("LOW_STOCK");
    expect(getStockStatus(100, 100)).toBe("LOW_STOCK");
  });

  it("is IN_STOCK above the reorder level", () => {
    expect(getStockStatus(101, 100)).toBe("IN_STOCK");
  });

  it("does not report CRITICAL/LOW when no reorder level is set", () => {
    // reorderLevel 0 means "not configured" -- the guards skip both branches
    // rather than treating every item as critically low.
    expect(getStockStatus(1, 0)).toBe("IN_STOCK");
    expect(getStockStatus(0, 0)).toBe("OUT_OF_STOCK");
  });
});

describe("computeAvailablePortions", () => {
  it("returns the portions the limiting ingredient allows", () => {
    // Recipe for 4 portions needs 400g beef and 200g rice.
    // Beef: 1200g / (400/4 = 100g per portion) = 12 portions.
    // Rice:  300g / (200/4 =  50g per portion) =  6 portions.
    const result = computeAvailablePortions([ing("Beef", 400, 1200), ing("Rice", 200, 300)], 4);
    expect(result.portions).toBe(6);
    expect(result.limitingItem).toBe("Rice");
  });

  it("names the bottleneck ingredient, because that is what staff restock", () => {
    const result = computeAvailablePortions([ing("Beef", 400, 100), ing("Rice", 200, 3000)], 4);
    expect(result.limitingItem).toBe("Beef");
    expect(result.portions).toBe(1);
  });

  it("is zero when an ingredient is out of stock", () => {
    const result = computeAvailablePortions([ing("Beef", 400, 0), ing("Rice", 200, 3000)], 4);
    expect(result.portions).toBe(0);
    expect(result.limitingItem).toBe("Beef");
  });

  it("rounds DOWN -- you cannot sell a fraction of a portion", () => {
    // 300g / 100g per portion = 3.0; 350g -> 3.5 -> 3
    expect(computeAvailablePortions([ing("Beef", 400, 350)], 4).portions).toBe(3);
    expect(computeAvailablePortions([ing("Beef", 400, 399)], 4).portions).toBe(3);
    expect(computeAvailablePortions([ing("Beef", 400, 400)], 4).portions).toBe(4);
  });

  it("treats a recipe with no ingredients as unavailable, not infinite", () => {
    // Guarding the `minPortions = Infinity` start value.
    expect(computeAvailablePortions([], 4)).toEqual({ portions: 0, limitingItem: null });
  });

  it("skips a zero-quantity line instead of dividing by zero", () => {
    // perPortion would be 0, so Math.floor(stock / 0) is Infinity. It happens
    // not to win the `possible < minPortions` comparison (Infinity < Infinity
    // is false), so the outcome is right either way -- but the guard is what
    // makes that deliberate rather than lucky.
    const result = computeAvailablePortions([ing("Zero", 0, 500), ing("Beef", 400, 800)], 4);
    expect(result.portions).toBe(8); // 800g / (400g per 4 portions = 100g) = 8
    expect(result.limitingItem).toBe("Beef");
  });

  it("skips a NEGATIVE-quantity line, which would otherwise poison the result", () => {
    // This is the case that makes the `<= 0` guard load-bearing, and it is
    // reachable: RecipeIngredient.quantity is Decimal(10,2) with no CHECK
    // constraint, and POST /api/recipes does not require a positive quantity.
    //
    // Without the guard: perPortion = -400/4 = -100, possible =
    // floor(500 / -100) = -5, which wins the comparison and reports the dish as
    // completely unavailable -- blaming an ingredient with a nonsense name,
    // which is what the POS then shows staff.
    const result = computeAvailablePortions(
      [ing("BadLine", -400, 500), ing("Beef", 400, 800)],
      4
    );
    expect(result).toEqual({ portions: 8, limitingItem: "Beef" });
    // For the record, the unguarded behaviour was:
    //   { portions: 0, limitingItem: "BadLine" }
  });

  it("returns nothing available when EVERY ingredient line is skipped", () => {
    // minPortions stays Infinity -> the fallback must not leak Infinity out.
    const result = computeAvailablePortions([ing("Zero", 0, 500)], 4);
    expect(result.portions).toBe(0);
    expect(result.limitingItem).toBeNull();
  });

  it("never returns a negative portion count", () => {
    // Negative stock shouldn't happen, but a stocktake correction could produce
    // it -- Math.max(0, ...) is the backstop.
    const result = computeAvailablePortions([ing("Beef", 400, -50)], 4);
    expect(result.portions).toBe(0);
  });

  it("reports the FIRST limiting ingredient when two tie", () => {
    const result = computeAvailablePortions([ing("Beef", 400, 400), ing("Rice", 200, 200)], 4);
    expect(result.portions).toBe(4);
    expect(result.limitingItem).toBe("Beef");
  });

  it("scales with portionsPerBatch", () => {
    // Same 400g of beef makes 4 portions if the batch is for 4,
    // but only 1 portion if the batch is defined as feeding 16.
    expect(computeAvailablePortions([ing("Beef", 400, 400)], 4).portions).toBe(4);
    expect(computeAvailablePortions([ing("Beef", 400, 400)], 16).portions).toBe(16);
  });

  it("handles a fractional portionsPerBatch without producing NaN", () => {
    const result = computeAvailablePortions([ing("Beef", 400, 400)], 2.5);
    expect(result.portions).toBe(2); // 400 / (400/2.5 = 160) = 2.5 -> 2
    expect(Number.isFinite(result.portions)).toBe(true);
  });
});
