# Step 2: Authentication + App Shell

## What's new in this step
- Login page (`/login`) backed by NextAuth + your Postgres `User` table
- Route protection: any `/dashboard/*` page redirects to `/login` if not signed in
- The app shell: collapsible sidebar (grouped navigation matching every module
  in the brief) + topbar (search, notifications, user profile, sign out)
- A seed script that creates a working admin login plus 2 sample rooms

## How to apply this step

1. **Copy these files into your existing `hms` project**, keeping the same
   folder structure (this zip mirrors it exactly — just drag the folders in
   and let them merge/overwrite):
   - `lib/prisma.ts`, `lib/auth.ts`
   - `types/next-auth.d.ts`
   - `app/api/auth/[...nextauth]/route.ts`
   - `middleware.ts`
   - `app/login/page.tsx`
   - `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`
   - `app/page.tsx` (overwrites the placeholder from Step 1)
   - `components/Sidebar.tsx`, `components/Topbar.tsx`
   - `prisma/seed.ts`
   - `package.json` (overwrites — just adds a `seed` config, nothing removed)

2. **Generate a real NEXTAUTH_SECRET.** Your `.env` currently has a placeholder
   string. In your terminal run:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and replace the `NEXTAUTH_SECRET` value in `.env` with it.

3. **Run the seed script** to create a working login:
   ```
   npm run seed
   ```
   This prints a login you can use:
   - email: `admin@hotel.com`
   - password: `Admin123!`

   (Change this password before showing the app to your client — it's just
   for development.)

4. **Start the app:**
   ```
   npm run dev
   ```
   Go to `http://localhost:3000` — it should redirect you straight to `/login`.
   Sign in with the seeded email/password above. You should land on
   `/dashboard` with the sidebar, topbar, and placeholder KPI cards.

5. **Try signing out** using the icon next to your name in the topbar — it
   should return you to `/login`, and trying to visit `/dashboard` directly
   afterward should bounce you back to `/login` too (that's the route
   protection working).

## What's next (Step 3)
- Rooms + Room Types management screens
- The Reservation Calendar (day/week/month views, drag-and-drop)
- Wiring the dashboard KPI cards to real numbers from the database

Come back and say "let's do step 3" when this is working.
