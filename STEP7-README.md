# Step 7: Inventory

## What's new
- **Inventory page** (`/dashboard/inventory`): KPI cards for Total Items, Low
  Stock, Stock Value, and Pending Purchases, plus a searchable stock table
  with a Low Stock / OK badge per item.
- Click any item to **Receive**, **Issue**, or **Adjust** its stock — each
  action is logged to the Audit Log (who, when, before/after quantity, and
  the reason for adjustments).
- **New Purchase Order**: pick an item, supplier, quantity, and cost. It sits
  under "Pending Purchase Orders" until you hit **Mark Received**, which
  updates stock automatically.
- **Add Item** (inside the same "Receive Stock" modal) lets you create a new
  inventory item with an opening stock count and optional unit cost — unit
  cost is what "Stock Value" on the dashboard is calculated from.

## Files in this step
- `prisma/schema.prisma` — added `unitCost` on `InventoryItem`, plus new
  `PurchaseOrder` / `PurchaseOrderStatus` models
- `app/api/inventory/route.ts`, `app/api/inventory/[id]/route.ts`
- `app/api/inventory/[id]/receive/route.ts`,
  `app/api/inventory/[id]/issue/route.ts`,
  `app/api/inventory/[id]/adjust/route.ts`
- `app/api/purchase-orders/route.ts`,
  `app/api/purchase-orders/[id]/receive/route.ts`
- `app/dashboard/inventory/page.tsx`
- `components/inventory/InventoryClient.tsx`

## Migration
This adds a new column and two new tables — nothing destructive:
```
npx prisma migrate dev --name inventory
```

## Try it out
1. Go to **Inventory**, add an item (e.g. "Bath Soap", category "Housekeeping
   Supplies", unit "pcs", reorder level 20, unit cost 50, opening stock 15).
2. It should immediately show as **Low Stock** since 15 ≤ 20.
3. Click it → **Receive** 50 more → stock badge flips to **OK**.
4. Create a **New Purchase Order** for another item, then **Mark Received**
   on it — confirm the item's stock increased by that quantity.
5. Check **Reports → Audit Log** area later (once built) — or for now,
   `npx prisma studio` → `AuditLog` table — to see the trail of every stock
   change.

## What's next
Expenses, Reports, Notifications, Staff/Roles & permissions — then security
hardening and deployment.
