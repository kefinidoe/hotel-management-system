# Setup — getting this running

Everything here runs on your machine. The sandbox this was developed in can reach
`registry.npmjs.org` and `github.com`, but not `binaries.prisma.sh` (so `prisma generate`
fails) and not Supabase (TCP connects, then the connection is reset) — so the app has never
been executed there. These are the steps to do it properly.

---

## 1. Install

```bash
npm install --legacy-peer-deps
```

> **`--legacy-peer-deps` is currently required.** `vite@8` wants
> `@types/node@^20.19.0 || >=22.12.0` and `package.json` pins `20.14.11`, so plain
> `npm install` fails with `ERESOLVE`. The real fix is to bump `@types/node`:
> ```bash
> npm install --save-dev @types/node@^20.19.0
> ```
> then plain `npm install` works. I didn't make that change for you because it touches your
> toolchain and I couldn't run `tsc` here to confirm nothing else shifts.

## 2. Create the database

Supabase → **New project**. Then **Project Settings → Database → Connection string**, and
copy **both** strings:

| | Which one | Port | Goes in |
|---|---|---|---|
| Transaction pooler | "Connection pooling", mode **Transaction** | `6543` | `DATABASE_URL` |
| Session pooler / direct | "Connection pooling", mode **Session**, or "Direct connection" | `5432` | `DIRECT_URL` |

`prisma migrate` needs the session/direct one because it opens prepared statements and
holds a session; the transaction pooler rejects both.

## 3. Configure `.env`

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `DIRECT_URL`, and generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put that in `NEXTAUTH_SECRET`. `NEXTAUTH_URL` should be `http://localhost:3000` with no
trailing slash.

**URL-encode the password** if it contains `@`, `#`, `/` or a space — `@` → `%40`, `#` → `%23`,
space → `%20`. This is the single most common cause of "can't reach database server".

## 4. Apply the schema and seed

```bash
npm run prisma:generate      # generates the client from schema.prisma
npx prisma migrate deploy    # applies the 5 migrations (use `migrate dev` if you're editing schema.prisma)
npm run seed                 # admin login, 6 tariffs, 26 rooms, payment methods, menu, 15 inventory items, 3 recipes
```

`npm run seed` prints the login it creates: `admin@hotel.com` / `Admin123!`.
**Change that password before anyone else can reach the app.**

If `migrate deploy` reports drift, `npx prisma migrate status` will tell you what it thinks
is out of sync — don't reach for `migrate reset`, it drops all data.

## 5. Run it

```bash
npm run dev
```

<http://localhost:3000> redirects to `/login`. Sign in, and you land on `/dashboard`.

## 6. Verify — run these and tell me what they say

```bash
npm run test:run             # expect 133 passed / 6 files
npm run lint                 # expect "No ESLint warnings or errors"
npx tsc --noEmit             # expect NO output. This is the one check still unproven.
npx prisma migrate status    # expect "Database schema is up to date!"
```

`npx tsc --noEmit` is the important one. Every type error I saw in the sandbox traced to the
un-generated Prisma client, so I expect this to be clean — but I could not prove it. If it
prints anything, paste the output.

---

## Checks that need no database at all

These run anywhere, including CI, because they build their own PostgreSQL from WebAssembly:

```bash
npx vitest run __tests__/schema/migrations.test.ts   # migrations vs schema.prisma vs real Postgres
npx vitest run __tests__/seed/seed.test.ts           # runs prisma/seed.ts against a fake client
npx vitest run __tests__/middleware/matcher.test.ts  # every /api route is actually guarded
npx vitest run __tests__/seed/seed.test.ts __tests__/middleware/matcher.test.ts
```

All three were checked to **fail** when the underlying bug is reintroduced, so they are real
guards rather than assertions that can't fail.

---

## Gotchas

- **`npm run seed` is safe to re-run.** Everything is an upsert. It will not duplicate rooms,
  payment methods or menu items.
- **`prisma/schema.prisma` reads `DIRECT_URL`.** If you only set `DATABASE_URL`, Prisma fails
  at startup with `Environment variable not found: DIRECT_URL`.
- **The Prisma client must be regenerated** after any `schema.prisma` change
  (`npm run prisma:generate`) or the types and the database disagree.
- **Don't commit `.env`** — it's already in `.gitignore`.
- **`prisma migrate dev` on production data** is a bad idea. Use `migrate deploy`.
