# Step 3: Rooms, Reservation Calendar, and Live Dashboard

## What's new in this step
- **Rooms page** (`/dashboard/rooms`): a visual room grid with status badges,
  add/edit/delete rooms, and a Room Types manager (name, rate, capacity)
- **Reservations page** (`/dashboard/reservations`): a room-by-day weekly
  timeline. Click an empty slot to create a reservation; drag a booking to a
  different day or room to reschedule it. Double-booking is blocked
  server-side.
- **Dashboard**: the KPI cards now show real numbers from your database
  (occupancy, today's revenue, available rooms, arrivals, departures,
  outstanding balance) instead of placeholders.

## What's simplified for now (so you have something working today)
- The reservation calendar is **week view only** — day/month views and
  filters (by room type, source, status) come later as the app matures.
- Creating a reservation is a single form rather than the full 7-step wizard
  from the brief — it covers guest, dates, room, and rate, which is enough to
  test the whole flow end to end.
- Reservations don't yet flip a room's status automatically (that happens in
  the **check-in/check-out step**, coming next).

## How to apply this step
1. Copy these files into your `hms` project, merging folders as before:
   - `lib/dates.ts`
   - `app/api/room-types/route.ts`, `app/api/room-types/[id]/route.ts`
   - `app/api/rooms/route.ts`, `app/api/rooms/[id]/route.ts`
   - `app/api/reservations/route.ts`, `app/api/reservations/[id]/route.ts`
   - `app/dashboard/rooms/page.tsx`
   - `app/dashboard/reservations/page.tsx`
   - `app/dashboard/page.tsx` (overwrites Step 2's placeholder dashboard)
   - `components/rooms/RoomsClient.tsx`
   - `components/reservations/ReservationsClient.tsx`

2. Restart your dev server if it's running (`Ctrl+C` then `npm run dev`
   again) so Next.js picks up the new routes.

3. **Try it out:**
   - Go to **Rooms** in the sidebar. You should see the 2 seeded rooms
     (101, 102). Click **Add Room** to add more, and **Room Types** to add
     types like Deluxe or Suite.
   - Go to **Reservations**. Click any empty day cell for a room to open the
     "New Reservation" form. Fill in a guest name and create it — a colored
     bar should appear on the calendar.
   - Try dragging that bar to a different day or a different room's row —
     it should move, and the change is saved to the database immediately.
   - Try creating a second reservation on the same room that overlaps the
     first one's dates — you should get a clear error instead of it silently
     double-booking.
   - Go back to **Dashboard** — the KPI cards should now reflect your actual
     room count and any reservations you created.

## What's next (Step 4)
- Guest management page + guest profiles
- Front Desk screen with Check-in / Check-out workflows
- Guest folios (billing) and payments — this is where "Today's Revenue" and
  "Outstanding Balance" on the dashboard start reflecting real transactions

Come back and say "let's do step 4" when this is working.
