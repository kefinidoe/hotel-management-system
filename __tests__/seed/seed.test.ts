import { describe, it, expect, beforeAll, vi } from "vitest";

/**
 * Executes the REAL prisma/seed.ts against a fake Prisma client.
 *
 * The fake enforces the two Postgres behaviours that the seed used to violate
 * on a fresh database:
 *   1. `update` on a row that doesn't exist -> P2025 (record to update does
 *      not exist). The old seed updated `tariff-triple-bo` before the loop
 *      that created it.
 *   2. creating a Room with a `roomTypeId` that isn't in RoomType -> foreign
 *      key violation. The old seed created rooms referencing
 *      `tariff-single-bo` / `tariff-triple-bo` before those existed.
 *
 * So this test fails loudly if the ordering inside seed.ts regresses, which
 * is exactly what makes `npm run seed` unusable on a fresh clone.
 *
 * It also guards the tariff NAMES, because lib/tariffs.ts resolves a booking's
 * occupancy by prefix-matching them ("Twin — ...") and the ids are legacy
 * ("tariff-triple-bo" is the Twin tariff). A rename that drops the "Twin"
 * prefix makes every twin-bed room silently unbookable.
 */

type Row = Record<string, any>;

const store: Record<string, Row[]> = {
  user: [],
  roomType: [],
  room: [],
  paymentMethod: [],
  menuCategory: [],
  menuItem: [],
  inventoryItem: [],
  recipe: [],
};

const errors: string[] = [];

function notFound(model: string, where: any): Error {
  const e = new Error(
    `P2025: An operation failed because it depends on one or more records that were required but not found. (model: ${model}, where: ${JSON.stringify(where)})`
  );
  e.name = "PrismaClientKnownRequestError";
  return e;
}

function fkViolation(model: string, field: string, value: any): Error {
  return new Error(
    `Foreign key constraint failed on \`${model}.${field}\`: "${value}" is not present in ${field === "roomTypeId" ? "RoomType" : field}`
  );
}

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

function findRow(model: string, where: Row): Row | undefined {
  return (store[model] ?? []).find((r) => matches(r, where));
}

/** Every model's API surface the seed actually uses, plus the FK checks. */
function modelApi(model: string) {
  return {
    upsert({ where, update, create }: { where: Row; update: Row; create: Row }) {
      const existing = findRow(model, where);
      if (existing) {
        Object.assign(existing, update ?? {});
        return Promise.resolve({ ...existing });
      }
      // Room creation is where the old seed blew up: it referenced tariff
      // room types that the tariff loop further down hadn't created yet.
      if (model === "room" && !findRow("roomType", { id: create.roomTypeId })) {
        return Promise.reject(fkViolation("room", "roomTypeId", create.roomTypeId));
      }
      const row = { ...create };
      (store[model] ??= []).push(row);
      return Promise.resolve({ ...row });
    },

    update({ where, data }: { where: Row; data: Row }) {
      const existing = findRow(model, where);
      if (!existing) return Promise.reject(notFound(model, where));
      Object.assign(existing, data);
      return Promise.resolve({ ...existing });
    },

    // Prisma's real signature is create({ data }). The seed uses it that way,
    // so the fake must unwrap `data` or every created row is stored as
    // `{ data: {...} }` and assertions on the row's fields silently miss.
    create({ data }: { data: Row }) {
      if (model === "room" && !findRow("roomType", { id: data.roomTypeId })) {
        return Promise.reject(fkViolation("room", "roomTypeId", data.roomTypeId));
      }
      const row = { ...data };
      (store[model] ??= []).push(row);
      return Promise.resolve({ ...row });
    },

    count() {
      return Promise.resolve((store[model] ?? []).length);
    },

    aggregate() {
      return Promise.resolve({ _sum: {}, _count: (store[model] ?? []).length });
    },

    findMany() {
      return Promise.resolve([...(store[model] ?? [])]);
    },
    findUnique({ where }: { where: Row }) {
      return Promise.resolve(findRow(model, where) ?? null);
    },
    deleteMany() {
      return Promise.resolve({ count: 0 });
    },
  };
}

let resolveDisconnect!: () => void;
const disconnected = new Promise<void>((r) => {
  resolveDisconnect = r;
});

const fakePrisma = new Proxy(
  { $disconnect: () => (resolveDisconnect(), Promise.resolve()) },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return modelApi(prop);
    },
  }
) as any;

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor() {
      return fakePrisma;
    }
  },
  RoleName: {
    ADMIN: "ADMIN",
    MANAGER: "MANAGER",
    RECEPTIONIST: "RECEPTIONIST",
    HOUSEKEEPER: "HOUSEKEEPER",
    WAITER: "WAITER",
    CASHIER: "CASHIER",
    ACCOUNTANT: "ACCOUNTANT",
    TECHNICIAN: "TECHNICIAN",
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: async () => "hashed" },
  hash: async () => "hashed",
}));

describe("prisma/seed.ts runs against an empty database", () => {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    errors.push(`process.exit(${code}) — main() rejected`);
    return undefined as never;
  }) as any);
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
    errors.push(args.map(String).join(" "));
  });

  beforeAll(async () => {
    // Importing the module runs main() (seed.ts has no exported function).
    await import("../../prisma/seed");
    await disconnected;
  });

  it("completes without Prisma errors", () => {
    expect(errors).toEqual([]);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("creates the admin login", () => {
    const admin = store.user.find((u) => u.email === "admin@hotel.com");
    expect(admin).toBeDefined();
    expect(admin?.role).toBe("ADMIN");
  });

  it("creates all 9 tariffs: 3 occupancies x 3 meal plans", () => {
    const names = store.roomType.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "Double — B&B",
        "Double — Bed Only",
        "Double — Half Board",
        "Single — B&B",
        "Single — Bed Only",
        "Single — Half Board",
        "Twin — B&B",
        "Twin — Bed Only",
        "Twin — Half Board",
      ].sort()
    );
  });

  it("names every tariff so lib/tariffs.ts can match it to an occupancy", () => {
    // Regression guard. The tariff ids are legacy ("tariff-triple-bo" is the
    // Twin-bed tariff), and lib/tariffs.ts resolves a booking's occupancy by
    // prefix-matching the tariff NAME against "Single"/"Double"/"Twin". If a
    // row is named "Triple — Bed Only", no Twin booking can ever match it and
    // the room looks unbookable.
    for (const t of store.roomType) {
      expect(t.name).toMatch(/^(Single|Double|Twin) — /);
    }
    const twinNames = store.roomType.filter((t) => t.name.startsWith("Twin")).map((t) => t.name).sort();
    expect(twinNames).toEqual(["Twin — B&B", "Twin — Bed Only", "Twin — Half Board"].sort());
    for (const id of ["tariff-triple-bo", "tariff-triple-bb", "tariff-triple-hb"]) {
      expect(store.roomType.find((t) => t.id === id)?.name).toMatch(/^Twin — /);
    }
  });

  it("keeps 3 meal plans per occupancy, all present in the MealPlan enum", () => {
    const mealPlans = store.roomType.map((t) => t.mealPlan).sort();
    expect(mealPlans).toEqual(
      [
        "BED_AND_BREAKFAST", "BED_AND_BREAKFAST", "BED_AND_BREAKFAST",
        "BED_ONLY", "BED_ONLY", "BED_ONLY",
        "HALF_BOARD", "HALF_BOARD", "HALF_BOARD",
      ].sort()
    );
  });

  it("creates the real 26-room list, with rooms 27 & 28 on the Twin tariff", () => {
    expect(store.room).toHaveLength(26);
    // migration 20261002090000_remove_room_is_twin dropped the isTwin column;
    // twin-bed rooms are now identified by pointing at the Twin tariff.
    expect(store.room.filter((r) => r.roomTypeId === "tariff-triple-bo").map((r) => r.number).sort())
      .toEqual(["27", "28"]);
    expect(store.room.some((r) => "isTwin" in r)).toBe(false);
    // Every room's roomTypeId must resolve — the fake rejects otherwise.
    for (const room of store.room) {
      expect(store.roomType.some((t) => t.id === room.roomTypeId)).toBe(true);
    }
  });

  it("creates the 4 payment methods", () => {
    expect(store.paymentMethod.map((m) => m.name).sort()).toEqual(
      ["Bank Transfer", "Cash", "Card", "M-Pesa"].sort()
    );
  });

  it("creates the starter menu, inventory and recipes", () => {
    expect(store.menuCategory).toHaveLength(5);
    expect(store.menuItem).toHaveLength(7);
    expect(store.inventoryItem).toHaveLength(15);
    expect(store.recipe).toHaveLength(3);
  });
});
