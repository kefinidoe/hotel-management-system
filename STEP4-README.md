# Step 4: Guests, Front Desk, Check-in/Check-out, Billing

## What's new in this step
- **Guests page** (`/dashboard/guests`): searchable guest list, click a guest
  for their full stay history and financial history
- **Front Desk page** (`/dashboard/front-desk`): today's arrivals, departures,
  and in-house guests, plus a **Walk-in** button
- **Check-in**: one click turns a reservation into a real stay — the room
  flips to Occupied, and a guest folio is opened with the room charge already
  posted on it
- **Guest folio / billing**: view charges and running balance, record
  payments (Cash, M-Pesa, Card, Bank Transfer), and complete checkout
- **Check-out**: closes the folio, flips the room to Dirty, and automatically
  queues a housekeeping task for it
- Sidebar now has a **Guests** link

## How to apply this step
1. Copy these files into your `hms` project (merge folders as before):
   - `components/reservations/CreateReservationModal.tsx` (new)
   - `components/reservations/ReservationsClient.tsx` (**replaces** the Step 3
     version — it now reuses the shared form above instead of a duplicate)
   - `app/api/guests/route.ts`, `app/api/guests/[id]/route.ts`
   - `app/dashboard/guests/page.tsx`
   - `components/guests/GuestsClient.tsx`
   - `app/api/check-in/route.ts`, `app/api/check-out/route.ts`
   - `app/api/payments/route.ts`, `app/api/payment-methods/route.ts`
   - `app/api/folios/[id]/route.ts`
   - `app/dashboard/front-desk/page.tsx`
   - `components/frontdesk/FrontDeskClient.tsx`, `components/frontdesk/FolioModal.tsx`
   - `prisma/seed.ts` (adds the 4 payment methods)
   - `components/Sidebar.tsx` (adds the Guests link)

2. **Re-run the seed** so your payment methods exist:
   ```
   npm run seed
   ```
   (Safe to re-run — it won't duplicate your admin user or rooms.)

3. Restart your dev server.

4. **Try the full flow:**
   - Go to **Reservations**, create a booking with **today** as check-in.
   - Go to **Front Desk** — it should appear under **Arrivals**. Click
     **Check In**.
   - The room should now show **OCCUPIED** on the Rooms page.
   - Back on Front Desk, that guest now appears under **In-house Guests**.
     Click **View Folio** — you'll see the room charge already listed.
   - Try **Record Payment** with a partial amount — the balance updates live.
   - Click **Complete Checkout**. The room should flip to **DIRTY** on the
     Rooms page (housekeeping now has a task, even though we haven't built
     that screen yet).
   - Go to **Guests**, search for that guest, and open their profile — you
     should see the stay in history and the closed folio's final balance.
   - Check the **Dashboard** — "Today's Revenue" and "Outstanding Balance"
     should reflect the payment you just recorded.

## What's simplified for now
- Walk-ins create a reservation for today; you still click **Check In**
  afterward rather than it happening in one step — keeps the logic in one
  place (check-in) instead of duplicating it.
- One room per reservation for now (matches Step 3) — multi-room bookings
  come later if you need them.

## What's next (Step 5)
- Housekeeping board (the tasks check-out already creates will show up here)
- Maintenance tickets

Come back and say "let's do step 5" when this is working.
