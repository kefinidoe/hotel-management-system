# Axis Hotel Alignment: Real Check-in Card + Tariff Structure

This isn't a numbered "Step" — it's the fix for the gap we found when you
shared Axis Hotel Nakuru's actual paper check-in card. It changes the
database, so there's a migration this time.

## What's new
- **Guest record** now captures Vehicle Registration (ID number and
  nationality already existed, just weren't on the form — now they are).
- **Reservation** now captures Payment Mode (at check-in, like the paper
  form) and a Discount amount.
- **Room Types** are restructured to match the real tariff card: occupancy
  (Single/Double/Triple) × meal plan (Bed Only / B&B) — 6 real rates instead
  of generic "Single/Double" placeholders.
- The **New Reservation** form (used by both the calendar and Front Desk
  walk-ins) now has all of these fields, grouped like the paper card, plus a
  "Check-out is strictly at 10:00 AM" reminder.
- A **discount**, if set, is automatically applied as a line item on the
  guest's folio at check-in.
- The **Guest profile** (Guests page) now shows ID number, nationality, and
  vehicle registration.

## How to apply this
1. Copy these files into your `hms` project (merge as usual):
   - `prisma/schema.prisma` (**overwrites** — adds new fields/enum, nothing removed)
   - `prisma/seed.ts` (adds the 6 real tariff room types)
   - `app/api/reservations/route.ts`
   - `app/api/check-in/route.ts`
   - `app/api/guests/[id]/route.ts`
   - `components/guests/GuestsClient.tsx`
   - `components/reservations/CreateReservationModal.tsx`
   - `components/frontdesk/FrontDeskClient.tsx`

2. **Run the migration** (this changes your database structure):
   ```
   npx prisma migrate dev --name axis_checkin_fields
   ```

3. **Re-run the seed** to add the 6 real tariff types:
   ```
   npm run seed
   ```
   This won't touch your existing rooms or guests — it only adds new room
   types alongside the old ones.

4. **Clean up the old generic room types:**
   - Go to **Rooms**, open room 101 (and 102, 107, or any others), and
     change its Room Type to the correct new one (e.g. "Double — B&B").
   - Then open **Room Types** and delete the old generic "Single" / "Double"
     entries — the manager will refuse to delete one that's still in use, so
     do the reassignment first.

5. Restart your dev server.

## Try it out
- Create a new reservation (calendar or walk-in) — you should see the full
  card: name, phone, National ID, nationality, vehicle reg, dates with the
  10 AM reminder, adults/children, room (now showing real tariff names like
  "Double — B&B"), rate, discount, and payment mode.
- Add a small discount and check that guest in — open their folio and
  confirm a "Discount" line appears, reducing the balance.
- Open that guest's profile on the **Guests** page — ID, nationality, and
  vehicle registration should all show.

Come back whenever you're ready to continue with the remaining modules
(Inventory, Expenses, Reports, Notifications, Staff/Roles) or anything else
you'd like to prioritize.
