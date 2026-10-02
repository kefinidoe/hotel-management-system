// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

/**
 * Runs the real migration SQL against a real PostgreSQL engine and checks it
 * against prisma/schema.prisma.
 *
 * "Real PostgreSQL" here means PGlite — Postgres compiled to WebAssembly and
 * run in-process — so this needs no database server, no Docker and no network,
 * and works identically on a laptop and in CI.
 *
 * What it catches that nothing else did:
 *
 *   1. A migration that doesn't apply to an empty database. Nobody had ever
 *      run these five files against a fresh schema — the same class of bug that
 *      made `npm run seed` fail (see __tests__/seed/seed.test.ts).
 *   2. Drift between prisma/schema.prisma and prisma/migrations. If someone
 *      edits the schema without writing a migration, the app's queries and the
 *      actual tables stop agreeing, and you find out in production.
 *   3. An enum literal in the app or seed that isn't a member of any real enum
 *      type — e.g. `status: "NEEDS_CLEANNG"`. TypeScript catches this when the
 *      literal is assigned to a typed field, but not in untyped request bodies
 *      or `as any` casts.
 *
 * Caveat: PGlite is currently PostgreSQL 18. Supabase may run 15 or 16. The
 * syntax used by these migrations is all long-stable, but a feature that is new
 * in 17/18 could in principle pass here and fail there.
 */

const MIGRATIONS_DIR = "prisma/migrations";
const SCHEMA_PATH = "prisma/schema.prisma";

/** Enum-like literals that are deliberately NOT database enums. */
const NON_DB_ENUM_LITERALS = new Set([
  "CRITICAL", // lib/inventory.ts `StockStatus` — a TypeScript union, computed at runtime
  "LOW_STOCK", //  "
  "OUT_OF_STOCK", //  "
  "IN_STOCK", //  "
]);

type PrismaModel = { name: string; fields: { name: string; type: string; isList: boolean; isRelation: boolean }[] };

function parsePrisma(src: string): { models: Map<string, PrismaModel["fields"]>; enums: Map<string, string[]> } {
  const models = new Map<string, PrismaModel["fields"]>();
  for (const m of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fields: PrismaModel["fields"] = [];
    for (const raw of m[2].split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const fm = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
      if (fm) fields.push({ name: fm[1], type: fm[2], isList: !!fm[3], isRelation: false });
    }
    models.set(m[1], fields);
  }

  // A field whose type is another model is a relation, not a column
  const modelNames = new Set(models.keys());
  for (const fields of models.values()) {
    for (const f of fields) if (modelNames.has(f.type)) f.isRelation = true;
  }

  const enums = new Map<string, string[]>();
  for (const m of src.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    enums.set(
      m[1],
      m[2]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//"))
    );
  }
  return { models, enums };
}

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((d) => fs.existsSync(path.join(MIGRATIONS_DIR, d, "migration.sql")))
    .sort();
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

let db: PGlite;
let migrationErrors: { dir: string; message: string }[] = [];
let dbColumns: Map<string, Set<string>>;
let dbEnumValues: Set<string>;
let dbEnumTypes: Map<string, string[]>;

beforeAll(async () => {
  db = new PGlite();
  migrationErrors = [];

  for (const dir of migrationFiles()) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    try {
      await db.exec(sql);
    } catch (e: any) {
      migrationErrors.push({ dir, message: e.message });
    }
  }

  const cols = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' order by table_name, ordinal_position`
  );
  dbColumns = new Map();
  for (const r of cols.rows) {
    if (!dbColumns.has(r.table_name)) dbColumns.set(r.table_name, new Set());
    dbColumns.get(r.table_name)!.add(r.column_name);
  }

  const enumRows = await db.query<{ typname: string; enumlabel: string }>(
    `select t.typname, e.enumlabel from pg_type t
       join pg_enum e on e.enumtypid = t.oid
      order by t.typname, e.enumsortorder`
  );
  dbEnumValues = new Set(enumRows.rows.map((r) => r.enumlabel));
  dbEnumTypes = new Map();
  for (const r of enumRows.rows) {
    if (!dbEnumTypes.has(r.typname)) dbEnumTypes.set(r.typname, []);
    dbEnumTypes.get(r.typname)!.push(r.enumlabel);
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("prisma migrations", () => {
  it("applies every migration cleanly to an empty database", () => {
    expect(migrationErrors).toEqual([]);
    expect(migrationFiles().length).toBeGreaterThan(0);
  });

  it("is the only source of truth for the schema (migrations are in sync)", () => {
    const { models, enums } = parsePrisma(fs.readFileSync(SCHEMA_PATH, "utf8"));

    const problems: string[] = [];

    for (const name of models.keys())
      if (!dbColumns.has(name)) problems.push(`missing table: ${name}`);
    for (const name of dbColumns.keys())
      if (!models.has(name)) problems.push(`extra table: ${name} (no matching Prisma model)`);

    for (const [model, fields] of models) {
      const tableCols = dbColumns.get(model);
      if (!tableCols) continue;
      for (const f of fields) {
        if (f.isRelation) continue;
        if (!tableCols.has(f.name)) problems.push(`missing column: ${model}.${f.name}`);
      }
      for (const col of tableCols)
        if (!fields.some((f) => !f.isRelation && f.name === col))
          problems.push(`extra column: ${model}.${col}`);
    }

    for (const [name, values] of enums) {
      const dbValues = dbEnumTypes.get(name);
      if (!dbValues) problems.push(`missing enum: ${name}`);
      else if (JSON.stringify(dbValues) !== JSON.stringify(values))
        problems.push(
          `enum ${name} differs — schema.prisma: [${values.join(", ")}] vs migrations: [${dbValues.join(", ")}]`
        );
    }

    expect(problems).toEqual([]);
  });

  it("has a foreign key behind every relation the seed and app depend on", async () => {
    const rows = await db.query<{ table_name: string; column_name: string; foreign_table: string }>(
      `select tc.table_name, kcu.column_name, ccu.table_name as foreign_table
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
         join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
        where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`
    );
    const fks = new Set(rows.rows.map((r) => `${r.table_name}.${r.column_name}->${r.foreign_table}`));

    // These are the ones whose absence would silently corrupt data rather than
    // throw: rooms pointing at a non-existent tariff, and the join tables.
    expect(fks).toContain("Room.roomTypeId->RoomType");
    expect(fks).toContain("ReservationRoom.reservationId->Reservation");
    expect(fks).toContain("ReservationRoom.roomId->Room");
    expect(fks).toContain("FolioItem.folioId->Folio");
    expect(fks).toContain("RecipeIngredient.recipeId->Recipe");
    expect(fks).toContain("RecipeIngredient.inventoryItemId->InventoryItem");
  });
});

describe("enum literals used by the app", () => {
  it("are all members of a real database enum", () => {
    const files = [...sourceFiles("app"), "prisma/seed.ts"].filter((f) => fs.existsSync(f));

    const used = new Map<string, Set<string>>();
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/["']([A-Z][A-Z0-9_]{2,})["']/g)) {
        if (!used.has(m[1])) used.set(m[1], new Set());
        used.get(m[1])!.add(file);
      }
    }

    expect(used.size).toBeGreaterThan(20); // guard against the regex silently breaking

    const unknown: string[] = [];
    for (const [literal, where] of used) {
      if (NON_DB_ENUM_LITERALS.has(literal)) continue;
      if (!dbEnumValues.has(literal)) unknown.push(`${literal} (used in ${[...where].join(", ")})`);
    }

    expect(unknown).toEqual([]);
  });
});
