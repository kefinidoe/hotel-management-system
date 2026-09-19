# Step 5: Housekeeping + Maintenance

## What's new in this step
- **Housekeeping board** (`/dashboard/housekeeping`): four columns — Needs
  Cleaning, Cleaning in Progress, Ready for Inspection, Ready Rooms. Rooms
  land here automatically after checkout (built in Step 4). Assign a staff
  member and move a room through the columns; the room's actual status
  updates automatically as you do (Dirty → Cleaning → Available).
- **Maintenance board** (`/dashboard/maintenance`): Open / In Progress /
  Waiting Parts / Completed ticket columns. Create a ticket for a room (with
  an option to take it out of service), assign a technician, add notes and
  cost, and mark it complete — completing a ticket automatically returns the
  room to Available.
- Both boards use a small shared **Staff API** for assignee dropdowns.

## How to apply this step
Copy these into your `hms` project (merge as usual):
- `app/api/staff/route.ts`
- `app/api/housekeeping/route.ts`, `app/api/housekeeping/[id]/route.ts`
- `app/api/maintenance/route.ts`, `app/api/maintenance/[id]/route.ts`
- `app/dashboard/housekeeping/page.tsx`
- `app/dashboard/maintenance/page.tsx`
- `components/housekeeping/HousekeepingClient.tsx`
- `components/maintenance/MaintenanceClient.tsx`

No database or seed changes needed this time. Restart `npm run dev`.

## Try it out
1. Run a full check-in → checkout on a reservation (like in Step 4) if you
   don't already have a "dirty" room.
2. Go to **Housekeeping** — that room should appear under "Needs Cleaning."
3. Assign it to a staff member (only your seeded Admin exists right now —
   we'll add real staff accounts in a later step, or you can add users
   directly in Prisma Studio: `npx prisma studio`).
4. Move it through the columns — check the **Rooms** page between each move
   and watch the room's status update to match (Dirty → Cleaning →
   Available).
5. Go to **Maintenance**, create a ticket for a room, tick "take out of
   service," and confirm the room shows **MAINTENANCE** on the Rooms page.
   Mark the ticket Completed and confirm the room returns to Available.

## Still pending (noted, not forgotten)
From Axis Hotel Nakuru's real check-in form: vehicle registration, payment
mode at check-in, the Bed-Only vs B&B meal-plan tariff structure, pax count,
and a discount field. We'll fold these into the check-in flow and room
types once the operational core (this step) is solid.

## What's next (Step 6)
- Restaurant POS with "Charge to Room" (posts straight to the guest's folio)

Come back and say "let's do step 6" when this is working.
