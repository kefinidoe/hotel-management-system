import { describe, it, expect } from "vitest";
import {
  readCartRequest,
  resolveCartLines,
  cartSubtotal,
  cartTotal,
  round2,
  type CartLine,
} from "../../lib/restaurant";
import { roundMoney } from "../../lib/billing";

/**
 * The restaurant POS checkout path. Two things here matter more than the rest:
 *
 *  1. `readCartRequest` is the trust boundary. The browser sends item IDs and
 *     quantities; names and prices are deliberately ignored because client data
 *     can be edited. If this ever starts accepting a price, a guest can set
 *     their own bill.
 *  2. `resolveCartLines` re-reads names and prices from the database inside the
 *     checkout transaction, and rejects inactive or missing items.
 *
 * So the tests are written as *attacks* on that boundary, not just as happy
 * paths.
 */

/** Stands in for Prisma's tx; only menuItem.findMany is exercised. */
function fakeTx(items: { id: string; name: string; price: unknown }[]) {
  return {
    menuItem: {
      findMany: async () => items,
    },
  } as any;
}

describe("readCartRequest — the trust boundary", () => {
  it("keeps only menuItemId and quantity", () => {
    const parsed = readCartRequest([{ menuItemId: "item-1", quantity: 2 }]);
    expect(parsed).toEqual([{ menuItemId: "item-1", quantity: 2 }]);
  });

  it("ignores any price or name the client tries to supply", () => {
    // The whole point: a forged price must not survive parsing.
    const parsed = readCartRequest([
      { menuItemId: "item-1", quantity: 1, unitPrice: 0.01, price: 0.01, name: "Free Beer" },
    ]);
    expect(parsed).toEqual([{ menuItemId: "item-1", quantity: 1 }]);
    expect(JSON.stringify(parsed)).not.toContain("0.01");
    expect(JSON.stringify(parsed)).not.toContain("Free Beer");
  });

  it("merges duplicate lines for the same item instead of double-billing", () => {
    const parsed = readCartRequest([
      { menuItemId: "item-1", quantity: 2 },
      { menuItemId: "item-1", quantity: 3 },
    ]);
    expect(parsed).toEqual([{ menuItemId: "item-1", quantity: 5 }]);
  });

  it("rejects duplicate lines whose combined quantity exceeds the cap", () => {
    // Each line is legal on its own (600 <= 1000); together they are not.
    // Without the combined check this is a way around the cap.
    expect(() =>
      readCartRequest([
        { menuItemId: "item-1", quantity: 600 },
        { menuItemId: "item-1", quantity: 600 },
      ])
    ).toThrow(/combined quantity/i);
  });

  it("rejects quantities that are not whole numbers in range", () => {
    for (const quantity of [0, -1, 1.5, 1001, NaN, Infinity, ""]) {
      expect(() => readCartRequest([{ menuItemId: "item-1", quantity }]), `q=${quantity}`).toThrow();
    }
  });

  it("coerces loosely before validating, which is safe here", () => {
    // `Number(quantity)` runs before the integer check, so "2" and even `true`
    // are accepted as quantities. Pinned deliberately rather than asserted as
    // strict: it is harmless because the value still has to come out as a whole
    // number in range, and item *prices* never travel through this function --
    // resolveCartLines reads those from the database. Tightening this to
    // `typeof quantity === "number"` is what a zod schema at the boundary
    // (ARCHITECTURE.md Tier 2 item 6) would give you.
    expect(readCartRequest([{ menuItemId: "i", quantity: "2" }])).toEqual([
      { menuItemId: "i", quantity: 2 },
    ]);
    expect(readCartRequest([{ menuItemId: "i", quantity: true }])).toEqual([
      { menuItemId: "i", quantity: 1 },
    ]);
    // ...but nothing can get through that isn't a whole number 1..1000.
    for (const quantity of [{}, [], "abc", "1.5", false]) {
      expect(() => readCartRequest([{ menuItemId: "i", quantity }]), `q=${String(quantity)}`).toThrow();
    }
  });

  it("accepts the boundaries exactly", () => {
    expect(readCartRequest([{ menuItemId: "i", quantity: 1 }])).toHaveLength(1);
    expect(readCartRequest([{ menuItemId: "i", quantity: 1000 }])).toHaveLength(1);
  });

  it("rejects a missing, empty or non-string item id", () => {
    for (const menuItemId of [undefined, null, "", "   ", 42, {}]) {
      expect(() => readCartRequest([{ menuItemId, quantity: 1 }]), `id=${String(menuItemId)}`).toThrow();
    }
  });

  it("rejects malformed entries outright", () => {
    // null / a bare string / a bare number are not objects at all.
    for (const entry of [null, "item-1", 42]) {
      expect(() => readCartRequest([entry])).toThrow(/valid menu item/i);
    }
    // An empty array IS an object to `typeof`, so it slips to the id check and
    // fails there instead. Different message, same rejection.
    expect(() => readCartRequest([[]])).toThrow(/reference a menu item/i);
  });

  it("returns an empty order for anything that isn't an array", () => {
    for (const raw of [null, undefined, {}, "item-1", 42]) {
      expect(readCartRequest(raw)).toEqual([]);
    }
    expect(readCartRequest([])).toEqual([]);
  });
});

describe("resolveCartLines — prices come from the database", () => {
  it("uses the stored price, not anything the client sent", async () => {
    const tx = fakeTx([{ id: "item-1", name: "Beef Stew", price: 550 }]);
    const lines = await resolveCartLines(tx, [{ menuItemId: "item-1", quantity: 2, price: 1 }]);

    expect(lines).toEqual([
      { menuItemId: "item-1", name: "Beef Stew", unitPrice: 550, quantity: 2 },
    ]);
    expect(cartTotal(lines)).toBe(1100);
  });

  it("coerces a Decimal price from Prisma to a number", async () => {
    // Prisma returns Decimal objects for @db.Decimal columns; Number() them.
    const tx = fakeTx([{ id: "item-1", name: "Soda", price: { toString: () => "100.50" } }]);
    const lines = await resolveCartLines(tx, [{ menuItemId: "item-1", quantity: 1 }]);
    expect(lines[0].unitPrice).toBe(100.5);
  });

  it("refuses an item that is gone or deactivated", async () => {
    // findMany filters isActive, so a removed item simply isn't in the result.
    const tx = fakeTx([]);
    await expect(resolveCartLines(tx, [{ menuItemId: "item-1", quantity: 1 }])).rejects.toThrow(
      /unavailable/i
    );
  });

  it("refuses a corrupt stored price rather than billing zero", async () => {
    for (const price of ["not a number", undefined, -5, NaN, {}]) {
      const tx = fakeTx([{ id: "item-1", name: "Mystery", price }]);
      await expect(
        resolveCartLines(tx, [{ menuItemId: "item-1", quantity: 1 }]),
        `price=${String(price)}`
      ).rejects.toThrow(/invalid/i);
    }
  });

  it("would bill null at zero, which is unreachable because the column is NOT NULL", async () => {
    // `Number(null)` is 0, so a null price would sail through the finite/>=0
    // checks as a free item. That is the classic JS trap and worth knowing
    // about -- but `MenuItem.price` is `Decimal @db.Decimal(10,2)`, i.e. NOT
    // NULL, so Prisma can never hand us null here. Pinned so that if the column
    // is ever made nullable, this test documents exactly what changes.
    const tx = fakeTx([{ id: "item-1", name: "Mystery", price: null }]);
    const lines = await resolveCartLines(tx, [{ menuItemId: "item-1", quantity: 1 }]);
    expect(lines[0].unitPrice).toBe(0);
  });

  it("accepts a legitimately free item (price 0)", async () => {
    const tx = fakeTx([{ id: "item-1", name: "Tap Water", price: 0 }]);
    const lines = await resolveCartLines(tx, [{ menuItemId: "item-1", quantity: 1 }]);
    expect(lines[0].unitPrice).toBe(0);
  });

  it("returns nothing for an empty order", async () => {
    expect(await resolveCartLines(fakeTx([]), [])).toEqual([]);
    expect(await resolveCartLines(fakeTx([]), null)).toEqual([]);
  });

  it("keeps every requested line when all items resolve", async () => {
    const tx = fakeTx([
      { id: "a", name: "A", price: 10 },
      { id: "b", name: "B", price: 20 },
    ]);
    const lines = await resolveCartLines(tx, [
      { menuItemId: "a", quantity: 1 },
      { menuItemId: "b", quantity: 2 },
    ]);
    expect(lines.map((l) => l.name)).toEqual(["A", "B"]);
  });
});

describe("cart totals", () => {
  const line = (unitPrice: number, quantity: number): CartLine => ({
    menuItemId: "x",
    name: "x",
    unitPrice,
    quantity,
  });

  it("multiplies price by quantity and sums", () => {
    expect(cartSubtotal([line(550, 2), line(100, 3)])).toBe(1400);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("rounds to 2dp instead of leaking float noise", () => {
    // 0.1 + 0.2 in binary floating point is 0.30000000000000004.
    expect(cartSubtotal([line(0.1, 1), line(0.2, 1)])).toBe(0.3);
    // 19.99 * 3 = 59.97000000000001
    expect(cartSubtotal([line(19.99, 3)])).toBe(59.97);
  });

  it("charges no VAT today, but keeps subtotal and total as separate concepts", () => {
    // Axis has no restaurant VAT configured. cartTotal is deliberately a
    // distinct function so adding tax later doesn't mean rewriting callers.
    const lines = [line(500, 2)];
    expect(cartTotal(lines)).toBe(cartSubtotal(lines));
    expect(cartSubtotal(lines)).toBe(1000);
  });

  it("rounds half-cents the same way roundMoney does", () => {
    // This is the regression guard for the bug this suite found: round2 used to
    // be `Math.round(v * 100) / 100`, which gives 1.00 for 1.005 (because
    // 1.005 * 100 is 100.49999999999999 in binary floating point).
    // lib/billing.ts's roundMoney adds Number.EPSILON first and gives 1.01.
    // Both write FolioItem.total, so they must agree.
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1);
    // ...and round2 is literally roundMoney, not a copy of it.
    expect(round2).toBe(roundMoney);
  });
});
