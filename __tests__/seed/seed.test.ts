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
  const rows = store[model] ?? [];
  const key = Object.keys(where)[0];
  return rows.find((r) => r[key] === where[key]);
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

    create(data: Row) {
      if (model === "room" && !findRow("roomType", { id: data.roomTypeId })) {
        return Promise.reject(fkViolation("room", "roomTypeId", data.roomTypeId));
      }
      const row = { ...data };
      (store[model] ??= []).push(row);
      return Promise.resolve({ ...row });
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

  it("creates all 6 tariff room types, with the Twin rows correctly named", () => {
    const names = store.roomType.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "Double — B&B",
        "Double — Bed Only",
        "Single — B&B",
        "Single — Bed Only",
        "Twin — B&B",
        "Twin — Bed Only",
      ].sort()
    );
    const twinBo = store.roomType.find((t) => t.id === "tariff-triple-bo");
    expect(twinBo?.capacity).toBe(2);
  });

  it("creates the real 26-room list, with only rooms 27 & 28 flagged isTwin", () => {
    expect(store.room).toHaveLength(26);
    expect(store.room.filter((r) => r.isTwin).map((r) => r.number)).toEqual(["27", "28"]);
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
    expect(store.menuCategory).toHaveLength(3);
    expect(store.menuItem).toHaveLength(7);
    expect(store.inventoryItem).toHaveLength(15);
    expect(store.recipe).toHaveLength(3);
  });
});
