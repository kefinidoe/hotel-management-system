# Hotel Management System — Architecture & Current State

Written from a full read of the repo at commit `1fb45bf` ("Update hotel management system").
Every claim below was checked against the files named next to it.

---

## 1. What this actually is

A **single Next.js 14 (App Router) application** for Axis Hotel Nakuru. There is no separate
backend service. The "backend" is:

- **PostgreSQL** (hosted on Supabase) holding the data
- **Prisma ORM** as the only thing that talks to that database
- **Next.js Route Handlers** in `app/api/**/route.ts` — these are the API

### About Supabase

Supabase is being used **only as a Postgres server**. Verified:

- `package.json` has no `@supabase/*` dependency (deps: prisma, next-auth, bcryptjs, next,
  react, recharts, zod, clsx, date-fns, lucide-react)
- `grep -ril supabase` across the repo returns only `.gitignore` and `README.md`
- `prisma/schema.prisma:8-12` points at Postgres via `DATABASE_URL` / `DIRECT_URL`

So Supabase Auth, Supabase Storage, Edge Functions, Row-Level Security and the
`@supabase/supabase-js` client are **all unused**. Auth is NextAuth with your own `User`
table and bcrypt hashes. If you ever want to swap Supabase for Neon or a local Postgres,
nothing in the app code changes — only the connection string.

---

## 2. The three layers and how they connect

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. SERVER COMPONENTS  (app/dashboard/**/page.tsx)                   │
│    - run on the server, import `prisma` DIRECTLY                    │
│    - read data with no HTTP hop, serialise Decimals/Dates to        │
│      plain numbers/ISO strings                                      │
│    - hand the result to a client component as props                 │
│    - all marked `export const dynamic = 'force-dynamic'`            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ props (already-serialised JSON-safe data)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. CLIENT COMPONENTS  (components/**/*Client.tsx)                   │
│    - "use client", hold useState, render the UI                     │
│    - on user action → fetch('/api/...')                             │
│    - on success → router.refresh()  (re-runs step 1, new props)     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ fetch() → HTTP
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ROUTE HANDLERS  (app/api/**/route.ts)                            │
│    - authenticate via getServerSession / requireAuth                │
│    - authorise via requireRole(session, [...])                      │
│    - write through prisma, often inside prisma.$transaction         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Prisma
                           ▼
                    PostgreSQL (Supabase)
```

**The key pattern to internalise:** reads happen in server components (no API call), writes
happen through `/api/*` route handlers. The API is not a general-purpose data layer — it is
a *mutation* layer with a handful of read endpoints the client needs after mount.

That is why, e.g., `app/dashboard/guests/page.tsx` queries `prisma.guest.findMany` itself
even though `app/api/guests/route.ts` does almost the same query.

### The refresh loop

`components/frontdesk/FrontDeskClient.tsx:39-41` is the canonical example:

```ts
function refresh() { router.refresh(); }   // after every mutation
```

Mutation → `fetch` → `router.refresh()` → server component re-queries Prisma → new props →
UI updates. No client-side cache, no React Query, no optimistic updates. Simple, always
correct, and the reason nothing in `components/` holds a stale copy of the data.

---

## 3. Data model (`prisma/schema.prisma`)

25 models and 13 enums. The spine of the system:

```
User (staff, 8 RoleName values, bcrypt passwordHash)

RoomType  (tariff: occupancy × meal plan, baseRate, capacity, mealPlan)
   └── Room (number, floor, status: 8 RoomStatus values, isTwin)

Guest (fullName, phone, email, idNumber, nationality, vehicleRegistration, isArchived)
   ├── Reservation (code "RES-2026-00125", checkInDate/checkOutDate, status, source,
   │                adults, children, paymentMode, discount, createdById)
   │      └── ReservationRoom (join table, per-room agreed `rate`)   ← multi-room ready
   └── Folio (isClosed)
          ├── FolioItem (type: ROOM_CHARGE|RESTAURANT|LAUNDRY|OTHER_SERVICE|DISCOUNT|TAX)
          └── Payment (paymentMethodId, amount, reference, cashierId)

HousekeepingTask (roomId, status, assigneeId)   MaintenanceTicket (roomId, title, status, cost)

MenuCategory → MenuItem (price) → Recipe (portions) → RecipeIngredient → InventoryItem
InventoryItem (base unit g|ml|pcs, currentStock, reorderLevel, costPerUnit)
   ├── StockMovement (every change, signed qty + beforeQty/afterQty)
   ├── Purchase        └── Wastage

Expense (status: PENDING_APPROVAL → APPROVED|REJECTED)
Notification    AuditLog
```

Design decisions worth knowing about:

- **Money is `Decimal(10,2)`.** Prisma returns these as JS `Decimal` objects, so every route
  does `Number(x)` before JSON-serialising. That's the `Number(rr.rate)` you see everywhere.
- **Inventory is stored in ONE base unit** (`g`, `ml`, `pcs`) and formatted for display in
  `lib/inventory.ts:formatQty` (`2000 g` → `"2.0 kg"`). No unit conversions anywhere in the
  recipe engine — deliberate, see the comment at `schema.prisma:337`.
- **`isArchived` / `isActive` instead of deletes.** Guests and inventory items are soft-hidden
  so historical folios and stock movements stay meaningful.
- **`AuditLog` and `Notification` exist in the schema but nothing writes to them** — verified:
  `grep -rn "auditLog\|prisma.notification" app components lib` returns 0 matches.
- **`Order` / `OrderItem` exist but nothing writes to them either** — the restaurant POS
  writes to `Folio`/`FolioItem` instead. These two models are dead weight today.

5 migrations, latest `20260929182000_add_room_is_twin`. Schema and migrations are in sync.

---

## 4. Authentication & authorisation

- **`lib/auth.ts`** — NextAuth Credentials provider. Looks up `User` by email,
  `bcrypt.compare` against `passwordHash`, rejects `isActive: false`, updates `lastLoginAt`.
  JWT session strategy; `id` and `role` are copied into the token in the `jwt` callback and
  into the session in the `session` callback.
- **`types/next-auth.d.ts`** — extends `Session` and `JWT` with `id` and `role`.
- **`middleware.ts`** — `next-auth/middleware`, matcher `["/dashboard/:path*"]`. This is what
  bounces an anonymous browser to `/login`.
- **`app/dashboard/layout.tsx`** — second check: `getServerSession` + `redirect("/login")`.
- **`lib/authz.ts`** — `requireAuth()` (401 if no session) and
  `requireRole(session, [...])` (403 if role not allowed).

**Important:** the middleware does **not** cover `/api/*`. Every route handler is responsible
for its own auth, and the audit in §6 shows several aren't.

Two auth styles coexist (worth unifying):

```ts
// style A — older routes
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = requireRole(session, ["ADMIN", "MANAGER", "RECEPTIONIST"]);
if (forbidden) return forbidden;

// style B — newer routes
const auth = await requireAuth();
if (auth instanceof NextResponse) return auth;
const forbidden = requireRole(auth, ["ADMIN", "MANAGER"]);
if (forbidden) return forbidden;
```

Roles in use: `ADMIN`, `MANAGER`, `RECEPTIONIST`, `HOUSEKEEPER`, `TECHNICIAN`, `ACCOUNTANT`.
`WAITER` and `CASHIER` are declared but never appear in any `requireRole` list — a waiter or
cashier can currently read everything a receptionist can, and can't do the restaurant writes
they'd need (those routes have no role check at all).

---

## 5. Module map — what's built

| Module | Page | Client component | API routes |
|---|---|---|---|
| Dashboard | `app/dashboard/page.tsx` (server, 6 KPIs computed inline) | — | — |
| Front Desk | `front-desk/page.tsx` | `FrontDeskClient`, `FolioModal` | `check-in`, `check-out`, `payments`, `payment-methods`, `folios/[id]` |
| Reservations | `reservations/page.tsx` | `ReservationsClient`, `CreateReservationModal` | `reservations`, `reservations/[id]` |
| Rooms | `rooms/page.tsx` | `RoomsClient` | `rooms`, `rooms/[id]`, `room-types`, `room-types/[id]` |
| Guests | `guests/page.tsx` | `GuestsClient` | `guests`, `guests/[id]` |
| Housekeeping | `housekeeping/page.tsx` | `HousekeepingClient` | `housekeeping`, `housekeeping/[id]` |
| Maintenance | `maintenance/page.tsx` | `MaintenanceClient` | `maintenance`, `maintenance/[id]` |
| Restaurant POS | `restaurant/page.tsx` | `RestaurantClient` | `menu`, `menu/items/[id]`, `menu/categories`, `restaurant/pay-now`, `restaurant/charge-to-room`, `restaurant/open-folios`, `restaurant/activity` |
| Inventory | `inventory/page.tsx` | `InventoryClient` + 6 sub-tabs/modals | `inventory`, `inventory/[id]`, `purchases`, `wastage`, `recipes`, `recipes/[id]`, `stock-movements` |
| Expenses | `expenses/page.tsx` | `ExpensesClient` | `expenses`, `expenses/[id]` |
| Reports | `reports/page.tsx` | `ReportsClient` | `reports` |
| Staff | `staff/page.tsx` | `StaffClient` | `staff`, `staff/[id]` |
| Global search | `SearchBar` in the topbar | — | `search` |

### The business rules that actually drive the app

**Check-in** (`app/api/check-in/route.ts`, one transaction):
1. reject if already `CHECKED_IN`
2. create a `Folio` for the guest + reservation
3. one `ROOM_CHARGE` FolioItem per room, `quantity = nights` (min 1), `total = rate × nights`
4. flip every room to `OCCUPIED`
5. if `reservation.discount > 0`, post a `DISCOUNT` item with a **negative** total
6. reservation → `CHECKED_IN`

**Check-out** (`app/api/check-out/route.ts`, one transaction):
close the open folio → reservation → `CHECKED_OUT` → every room → `DIRTY` → create a
`NEEDS_CLEANING` HousekeepingTask per room.

**Housekeeping → room status** (`app/api/housekeeping/[id]/route.ts`): a lookup table maps
task status to room status — `NEEDS_CLEANING→DIRTY`, `IN_PROGRESS→CLEANING`,
`READY_FOR_INSPECTION→CLEANING`, `READY→AVAILABLE`.

**Maintenance → room status**: creating a ticket with `takeOutOfService` sets the room
`MAINTENANCE`; marking it `COMPLETED` sets the room back to `AVAILABLE`.

**Double-booking prevention** (`lib/dates.ts:rangesOverlap` +
`app/api/reservations/route.ts:79-97`): loads every `ReservationRoom` on that room whose
reservation is not `CANCELLED`/`NO_SHOW`, and rejects with **409** on any
`[checkIn, checkOut)` overlap. The PUT route repeats the check excluding itself.

**Recipe stock engine** (`lib/inventory.ts`):
- `computeAvailablePortions(ingredients, portions)` → how many whole portions can be made
  right now, plus the bottleneck ingredient. Surfaced on the POS as `availablePortions`.
- `deductRecipeStock(tx, lines, reference, userId)` — aggregates everything needed across the
  whole cart, **checks all of it before writing anything**, throws if short, and runs inside
  the caller's transaction. Menu items with no recipe are skipped (treated as always
  available). A short ingredient rolls back the entire paid order — never a sale with no
  deduction.

**Expense approval** (`app/api/expenses/route.ts:31-33` + `[id]/route.ts`): every expense is
forced to `PENDING_APPROVAL` regardless of input; only `ADMIN`/`MANAGER` can move it, and a
reviewed expense can't be reviewed twice.

**Staff safety guards** (`app/api/staff/[id]/route.ts`): an admin can't demote/deactivate
themselves, and can't remove the last remaining active admin.

**Tariff matching** (`components/reservations/CreateReservationModal.tsx:66-71`): room 27/28
are `isTwin` → "Twin" tariff; otherwise Single/Double is chosen. That plus the meal plan picks
one of 6 seeded room types, and its `baseRate` becomes the reservation rate.

---

## 6. Verified problems

These are checked, not guessed.

### 6.1 ~~`npm run seed` fails on a fresh database~~ — **FIXED**

> Fixed in `prisma/seed.ts`: the tariff room-type upsert loop (and the Twin rename) now runs
> *before* anything references those ids, and the placeholder `seed-single`/`seed-double`
> room types and rooms 101/102 are gone. Guarded by `__tests__/seed/seed.test.ts`, which runs
> the real seed file against a fake Prisma client that enforces foreign keys and P2025.
> Running that harness against `1fb45bf:prisma/seed.ts` reproduces
> `P2025 ... (model: roomType, where: {"id":"tariff-triple-bo"})` → `process.exit(1)`.

*What it was:* the old file updated `tariff-triple-bo` at line 104 while the loop that creates
it was at line 163, so an empty database threw `P2025: Record to update does not exist`. The
room-creation loop referenced `tariff-single-bo`/`tariff-triple-bo` before they existed too.
It only ever worked on a database where a previous seed run had already created those rows.
It also upserted placeholder rooms 101/102 on `seed-single`/`seed-double` and then immediately
found and deleted every room on those two room types — pure churn on every run.

### 6.2 ~~Six API endpoints have no authentication at all~~ — **FIXED**

> `middleware.ts` now guards every `/api/*` route except `/api/auth/*`, returning a real
> **401 JSON** for API calls (a redirect would be followed silently by `fetch()` and the
> caller would try to parse the login page as JSON) and a redirect to `/login?callbackUrl=…`
> for `/dashboard/*`. Matcher verified with Next's own `getPathMatch`:
> `/api/auth/signin`, `/api/auth/session`, `/api/auth/callback/*` stay public; `/api/rooms`,
> `/api/reservations`, `/api/restaurant/activity` etc. are guarded.
> The six handlers below also got explicit `requireAuth()` calls, so they are safe even if the
> middleware matcher is ever changed. A re-run of the audit script reports **0** unauthenticated
> handlers.
>
> Still open below this table: the authenticated-but-unrole-checked routes.

Per-handler audit of all 38 route files (55 REST handlers, plus the NextAuth catch-all). These return real data to an unauthenticated caller:

| Route | Method | Exposes |
|---|---|---|
| `app/api/reservations/route.ts` | GET | every reservation: guest name, phone, dates, room, rate |
| `app/api/restaurant/activity/route.ts` | GET | today's restaurant revenue + last 12 sales with guest names and room numbers |
| `app/api/rooms/route.ts` | GET | full room list with status |
| `app/api/room-types/route.ts` | GET | full tariff card |
| `app/api/menu/route.ts` | GET | full menu with prices and stock-derived availability |
| `app/api/maintenance/route.ts` | GET | every maintenance ticket with room, assignee and cost |

`middleware.ts` only matches `/dashboard/:path*`, so none of these are protected by it.
The dashboard pages happen to work because they query Prisma directly — but the endpoints
are open to anyone who knows the URL.

Separately, several authenticated routes have **no role check** where one probably belongs:
`restaurant/charge-to-room` POST, `restaurant/pay-now` POST, `menu/items/[id]` PUT/DELETE,
`recipes` POST/PATCH/DELETE, `purchases` POST, `wastage` POST, `rooms/[id]` PUT/DELETE,
`expenses` POST.

### 6.3 The 119 tests pass but test none of your code

`npm run test:run` → **119 passed**, matching `TESTING.md`. But:

```
grep -Ec "from ['\"](@/|\.\./\.\./(app|lib|components))" __tests__/**/*.test.ts
__tests__/workflows/guest-lifecycle.test.ts:0
__tests__/api/endpoints.test.ts:0
__tests__/utilities/helpers.test.ts:0
```

None of the three imports anything from `app/`, `lib/` or `components/` — `helpers.test.ts`
and `guest-lifecycle.test.ts` import only `vitest`; `endpoints.test.ts` adds
`__tests__/fixtures/mock-data.ts`. They assert against object literals written inside the
test, e.g. `__tests__/api/endpoints.test.ts:17-21`:

```ts
it('should fetch all guests', () => {
  const guests = [mockGuest];
  expect(guests).toHaveLength(1);
```

No route handler, no `lib/` function, no component is executed. Changing
`app/api/check-in/route.ts` to something broken would keep all 119 green. `TESTING.md`
describes this suite as covering "all API endpoints" and "the complete guest lifecycle" — it
does not.

### 6.4 ~~`.env.example` is not usable~~ — **FIXED**

> Rewritten: the malformed password is gone, both `DATABASE_URL` (transaction pooler, port
> 6543) and `DIRECT_URL` (session pooler / direct, port 5432) are present and documented, with
> a note on URL-encoding the password and on `NEXTAUTH_URL` having no trailing slash.

```
DATABASE_URL="postgresql://USER:hotel management system@localhost:5432/hms?schema=public"
```

The password is literally the words "hotel management system" with unescaped spaces — looks
like the repo name was pasted in by accident. And `prisma/schema.prisma:11` reads
`directUrl = env("DIRECT_URL")`, but `DIRECT_URL` is not in `.env.example` at all.

For Supabase you need both:
- `DATABASE_URL` → the **transaction pooler** (port 6543) for the app
- `DIRECT_URL` → the **session pooler / direct connection** (port 5432) for `prisma migrate`

### 6.5 No lint config, and no typecheck possible without `prisma generate`

**Partially fixed.** `.eslintrc.json` (`next/core-web-vitals`) now exists, `npm run lint`
works, and it found and I fixed 8 real `react/no-unescaped-entities` errors in
`app/dashboard/page.tsx`, `components/SearchBar.tsx`, `components/inventory/CreateRecipeModal.tsx`,
`components/inventory/RecipesTab.tsx` and `components/staff/StaffClient.tsx`. It now reports
`✔ No ESLint warnings or errors`.

Still open: the `tsc` errors, which all trace to the un-generated Prisma client.
- `npx tsc --noEmit` fails with ~30 errors, but **all** trace to one root cause: the Prisma
  client isn't generated, so `@prisma/client` exports no `RoleName` and every
  `prisma.x.findMany()` returns `any` (hence the `TS7006 implicitly has an 'any' type` on
  every `.map()` callback). Run `npx prisma generate` and they should clear. I could not
  verify that here — see §7.

### 6.6 Dependency drift

Declared in `package.json`, imported nowhere in `app/`, `components/` or `lib/`
(verified by grep):

- **`zod` 3.23.8** — all validation is hand-rolled `if (!body.x)` checks. This is why several
  routes accept unvalidated input (`rooms/[id]` PUT passes `body.number`, `body.status`
  straight into Prisma).
- **`date-fns` 3.6.0** — `lib/dates.ts` reimplements the handful of helpers by hand.
- **`recharts` 2.12.7** — `ReportsClient` renders numbers in tables, no charts.

Also: `npm install` fails with `ERESOLVE` (`vite@8.3.0` needs `@types/node ^20.19 || >=22.12`,
root pins `20.14.11`). It needs `--legacy-peer-deps`, which `TESTING.md` mentions but
`README.md` doesn't.

### 6.7 Stale docs

`STEP7-README.md` lists routes that don't exist in the repo
(`app/api/inventory/[id]/receive|issue|adjust/route.ts`, `app/api/purchase-orders/**`,
`PurchaseOrder` model). Those were replaced by `PATCH /api/inventory/[id]` with `newQuantity`
and by `app/api/purchases/route.ts`. `STEP6-README.md` similarly points at
`app/api/restaurant/checkout/route.ts`, now split into `pay-now` and `charge-to-room`.

### 6.8 Smaller things

- **Reservation codes can collide.** `app/api/reservations/route.ts:129-130` builds
  `RES-{year}-{count+1}` from `prisma.reservation.count()`. Delete or cancel anything and two
  reservations can get the same code → unique-constraint 500.
- **`paymentMode` is captured but never surfaced** on the folio or in reports.
- **`FolioItem.taxRate` exists and is stored, but folio totals ignore it** — restaurant lines
  bake VAT into `total` at write time (`restaurant/pay-now/route.ts:67`) and room charges use
  `taxRate: 0`. There's no single "compute a folio total" function; the sum is recomputed
  inline in `folios/[id]`, `guests/[id]` and `app/dashboard/page.tsx`.
- **Notifications**: the bell in `components/Topbar.tsx:21-23` is a dead button.
- **Reports**: `/api/reports` groups `FolioItem` by type and `Payment` by method, but there's
  no occupancy/ADR/RevPAR report, no per-day series, and no export.

### 6.9 Migrations verified against real PostgreSQL — **NO DRIFT FOUND**

Not a bug: the first time these migrations have ever been executed. All 5 files apply
cleanly to an empty database, and the result matches `prisma/schema.prisma` exactly:

| | schema.prisma | migrated database |
|---|---|---|
| Models / tables | 25 | 25 |
| Enums | 13 | 13 |
| Scalar + enum columns | 193 | 193 |
| Foreign keys | — | 30 |

Enum values match member-for-member, table-for-table, column-for-column. There is no drift
and no missing migration.

Also checked: every enum literal in `app/**/*.ts{,x}` and `prisma/seed.ts` (34 of them —
`"NEEDS_CLEANING"`, `"CHECKED_IN"`, `"MEAL_SALE"`, `"BED_AND_BREAKFAST"`, …) is a real member
of a real enum type. The only three that aren't are `CRITICAL`, `LOW_STOCK` and
`OUT_OF_STOCK`, which come from the `StockStatus` TypeScript union in `lib/inventory.ts` and
are correctly not database enums.

All of this is guarded by `__tests__/schema/migrations.test.ts`, which was verified to fail
on three injected faults: a broken migration, a field added to `schema.prisma` with no
migration, and a typo'd enum literal in `app/api/check-out/route.ts`.

### 6.10 There is a second, much larger branch of work: `fix/stabilization`

**This is the most important thing in this document.**

On 2026-10-02 the remote gained `fix/stabilization` (HEAD `8ea59be`) — it did not exist when
this branch was created. It is **104 files, ~9,348 insertions**, and it goes considerably
further than this branch:

| | `fix/stabilization` | this branch |
|---|---|---|
| Files changed | 104 | 20 |
| Extra migrations | **4** (wastage accountability, menu-category normalisation, dashboard indexes, `Room.isActive`) | 0 |
| New `lib/` modules | `password`, `permissions`, `page-auth`, `reservation-code`, `reporting`, `report-export`, `seed-guard`, `restaurant-dashboard` | 0 |
| Security | session revocation on every read, 12h session cap, default admin password removed, staff delete | blanket `/api/*` guard |
| New real tests | 2 (`auth/session-revocation`, `seed/cleanup-guard`) | 14 |
| Lint config + fixes | no | yes (`npm run lint` clean) |
| Docs | — | `ARCHITECTURE.md`, `SETUP.md`, corrected `TESTING.md` |

Both branches independently fixed the same two bugs — the 6 unauthenticated GET endpoints and
the seed ordering. **That is corroboration that those were real bugs, not stylistic
preferences.**

I ran the same migration/drift harness against `fix/stabilization`: **9 migrations apply
cleanly, 25 models / 25 tables, 13 enums, 196 columns, no drift.** Its 59 REST handlers are
all authenticated (at the handler level; its `middleware.ts` still only matches
`/dashboard/*`, so nothing there is protected by a blanket guard). The 119 placeholder tests
are still present and still test nothing.

#### The practical consequence

The two branches overlap in `prisma/seed.ts`, `package.json`, `vitest.config.ts` and
`middleware.ts`. They cannot both land on `main` as-is — a naive merge will conflict in the
seed, and picking one side wholesale will throw away the other's fixes.

**Decide which is the base before either merges.** Consolidation options, cheapest first:

1. **Take `fix/stabilization` as the base, cherry-pick this branch's 6 commits onto it**
   (middleware guard, `.eslintrc` + 8 lint fixes, `.env.example`, `SETUP.md`,
   `ARCHITECTURE.md`, and the three real test suites). The seed fix on that branch is
   equivalent, so that commit can be dropped.
2. Merge `fix/stabilization` into this branch (stays on this branch, resolves conflicts once).
3. Merge both to `main` separately and resolve conflicts there — the most work, and the most
   chance of silently losing a fix.

---

## 7. What I could and couldn't run in this sandbox

| Command | Result |
|---|---|
| `npm install` | ❌ `ERESOLVE` (vite 8 vs `@types/node` 20.14.11) |
| `npm install --legacy-peer-deps` | ✅ 552 packages |
| `npm run test:run` | ✅ 133 passed / 6 files (119 placeholders + 14 real — see §6.3) |
| `npx tsc --noEmit` | ❌ as-is: 36 errors, all `TS7006` implicit-any |
| `npx tsc --noEmit --noImplicitAny false` | ✅ **0 errors** — see below |
| `npx tsc --noEmit middleware.ts` (isolated) | ✅ clean |
| `npx next lint` | ✅ clean (was: blocked on the interactive ESLint setup prompt) |
| TCP to `aws-1-eu-west-1.pooler.supabase.com:6543` and `:5432` | ✅ connect |
| TLS/`pg` handshake to that host | ❌ `ECONNRESET` / "Connection terminated unexpectedly" — a transparent proxy accepts the TCP connection, then resets. `https://supabase.com` returns `000` |
| `npx prisma generate` | ❌ `binaries.prisma.sh` unreachable; `--no-engine` and the wasm engine don't bypass it |
| `npx prisma validate` / `migrate` | ❌ same engine download |
| `npm run dev` | ❌ needs the generated client (and, for anything past `/login`, a reachable database) |

### Typechecking without the Prisma engine

`prisma generate` can't run here, and the stub `@prisma/client` ships when it hasn't been
generated exports `PrismaClient: any` — so every `.map()` / `.find()` / `.reduce()` callback
on a query result had no contextual type and raised `TS7006`. That masked everything else.

I generated a local stand-in `default.d.ts` in `node_modules` (never committed — it lives in
gitignored `node_modules`, and it is **not** a substitute for the real client) that declares
the 13 enums from `schema.prisma` and 25 model delegates returning `any[]`. Results:

| check | result |
|---|---|
| `tsc --noEmit` with the stub | 36 errors, **every one `TS7006`** |
| ...of which non-`TS7006` (i.e. real type errors) | **0** |
| `tsc --noEmit --noImplicitAny false` (neutralises the stub) | **0 errors** |

All 36 are callbacks on values that came from a Prisma query — `prisma.$transaction(async (tx)`,
`reservation.folios.find((f) => …)`, `folio.items.reduce((s, i) => …)` — exactly where the real
generated client supplies the type. So no genuine type error surfaced, but this is **not**
proof the code typechecks: the stub cannot check Prisma query shapes at all. Only
`npx prisma generate && npx tsc --noEmit` on your machine settles it.

### What I *can* do without the Prisma engine: a real database, in-process

`@electric-sql/pglite` is **PostgreSQL compiled to WebAssembly** and installed from npm — so
it runs here, and in CI, with no server and no network. That is enough to actually execute
the migration SQL and inspect the result, which is how §6.9 was verified.

It is now a **devDependency** (`@electric-sql/pglite@0.5.8`, ~5 MB) used only by
`__tests__/schema/migrations.test.ts`. Remove it if you'd rather not carry it — just delete
that one test file and the dependency.

Caveat: PGlite is PostgreSQL **18**; Supabase may be running 15 or 16. Everything these
migrations use is long-stable syntax, but a feature introduced in 17/18 could pass here and
fail there. It is not a substitute for running `prisma migrate deploy` against the real
project once.

**So: the app itself has not been executed here.** Everything in §2–§6 comes from reading
the source, plus the greps and commands shown.

---

## 8. Suggested order of work

**Tier 1 — before any new features** (cheap, unblocks everything else) — **done**
1. ✅ `.env.example` rewritten with both Supabase pooler URLs (§6.4).
2. ✅ `prisma/seed.ts` ordering fixed so a fresh clone can seed (§6.1).
3. ✅ Auth added to the 6 open endpoints + a blanket `/api/*` middleware guard (§6.2).
4. ✅ `.eslintrc.json` added; `npm run lint` is clean (§6.5).
   ✅ `SETUP.md` written — Supabase + `.env` + `migrate` + `seed` + the checks to run locally.
   ⬜ `tsc --noEmit` still needs `prisma generate`, which needs network access to
   `binaries.prisma.sh`. Run it on your machine: `npm run prisma:generate && npx tsc --noEmit`.

**Tier 2 — trust**
5. Replace the fake tests with real ones: unit-test `lib/dates.ts`, `lib/restaurant.ts`,
   `lib/inventory.ts` (pure functions, trivial to test), then route-handler tests with a
   mocked Prisma client, then a real integration suite against a throwaway Postgres.
6. Add `zod` schemas at the route boundaries (it's already installed).
7. Make reservation codes collision-proof.
8. Extract one `computeFolioTotals()` helper and use it in all three places.

**Tier 3 — finish the half-built things**
9. Wire up `AuditLog` writes (the schema and the `before`/`after`/`reason` columns are
   already there) and an Audit Log screen.
10. Wire up `Notification` + the dead bell icon.
11. Decide the fate of `Order`/`OrderItem` — either use them for the POS or drop them.
12. Role coverage for `WAITER` and `CASHIER`.

**Tier 4 — features not started yet**
13. Reservation day/month calendar views and filters (week view only today).
14. Multi-room bookings (the `ReservationRoom` join table already supports it; the API and
    `CreateReservationModal` assume `rooms[0]`).
15. Night audit / end-of-day rollover.
16. Occupancy / ADR / RevPAR reports and charts.
17. Printing: folio invoice, check-in card, registration report.
18. Rate calendar / seasonal pricing.
19. Deployment (Vercel + Supabase) and CI.
