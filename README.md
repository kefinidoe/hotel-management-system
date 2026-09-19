# Hotel Management System — Step 1: Scaffold + Design System + Database Schema

## What's in this step
- Next.js + TypeScript project scaffold
- Tailwind design system (colors, spacing, buttons, cards, badges) matching the
  premium hospitality brief
- Full Prisma database schema: users/roles, rooms, room types, guests,
  reservations, folios, folio items, payments, housekeeping, maintenance,
  restaurant menu, inventory, expenses, notifications, audit log

## How to run this in VS Code

1. **Install Node.js** (v18+) if you don't have it: https://nodejs.org

2. **Open this folder in VS Code**, then open a terminal (`` Ctrl+` ``) and run:
   ```bash
   npm install
   ```

3. **Set up PostgreSQL.** Easiest options:
   - Install Postgres locally, or
   - Use a free hosted instance (e.g. Neon.tech or Supabase) — copy the
     connection string they give you.

4. **Create your `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Then paste your real database URL into `DATABASE_URL`.

5. **Create the database tables from the schema:**
   ```bash
   npx prisma migrate dev --name init
   ```
   This reads `prisma/schema.prisma` and creates all the tables in Postgres.

6. **Run the app:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you should see a card confirming the design
   system is wired up correctly.

7. **(Optional) Browse your database visually:**
   ```bash
   npx prisma studio
   ```

## What's next (Step 2)
- Authentication (NextAuth) + role-based access
- The application shell: collapsible sidebar, topbar, active-page highlighting
- Seed script with realistic sample data (18 rooms, guests, reservations)
  so the dashboard isn't empty

Come back to this chat and say "let's do step 2" when you're ready and I'll
give you the next batch of files the same way.
