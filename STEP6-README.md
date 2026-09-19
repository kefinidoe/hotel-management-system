# Step 6: Restaurant POS + Charge to Room

## What's new
- **Restaurant page** (`/dashboard/restaurant`): categories on the left,
  menu items in the middle (tap to add), running order on the right
- **Checkout options**: pay directly with any seeded payment method (Cash,
  M-Pesa, Card, Bank Transfer), or **Charge to Room** — type a room number
  and the order posts straight onto that guest's open folio
- Direct payments are recorded as their own closed folio + payment, so they
  flow into the dashboard's "Today's Revenue" just like room payments do
- A starter menu (Breakfast, Lunch, Drinks) is seeded so the POS isn't empty

## How to apply this step
Copy these into your `hms` project:
- `app/api/menu/route.ts`
- `app/api/restaurant/checkout/route.ts`
- `app/dashboard/restaurant/page.tsx`
- `components/restaurant/RestaurantClient.tsx`
- `prisma/seed.ts` (adds the starter menu — safe to re-run: `npm run seed`)

Restart `npm run dev` after.

## Try it out
1. Go to **Restaurant**. Add a couple of items to the order.
2. Click **Pay with Cash** (or any method) — you should get a confirmation,
   and the order clears.
3. Check the **Dashboard** — "Today's Revenue" should include that sale.
4. Now check a guest in (Front Desk, if you don't have one in-house), note
   their room number, go back to **Restaurant**, add items, and click
   **Charge to Room** — enter that room number and confirm.
5. Go to **Front Desk → View Folio** for that guest — the restaurant charge
   should appear as a line item alongside their room charge.
6. Try charging to a room with no one checked in — you should get a clear
   error instead of it silently failing.

## What's next (Step 7)
- Inventory (stock tracking, low-stock alerts, receive/issue stock)

Come back and say "let's do step 7" when this is working.
