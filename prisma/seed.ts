import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generatePassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@hotel.com";

  // There is deliberately NO fixed fallback password here.
  //
  // This repository is public, so any hard-coded default is a *published*
  // credential: anyone who reads the repo could sign in as ADMIN on any
  // deployment that still had it. Instead we use SEED_ADMIN_PASSWORD when it's
  // provided, and otherwise generate a strong random password and print it once,
  // below. If the admin already exists, its password is never touched --
  // re-running the seed must not silently reset a working login.
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  let admin = existingAdmin;
  let newPassword: string | null = null;

  if (!existingAdmin) {
    newPassword = process.env.SEED_ADMIN_PASSWORD || generatePassword();
    admin = await prisma.user.create({
      data: {
        name: "Hotel Admin",
        email: adminEmail,
        passwordHash: await bcrypt.hash(newPassword, 10),
        role: RoleName.ADMIN,
        department: "Management",
      },
    });

    console.log("");
    console.log("  ┌─ Seeded admin login ─────────────────────────────────────────");
    console.log(`  │  email:    ${adminEmail}`);
    console.log(`  │  password: ${newPassword}`);
    console.log("  │");
    console.log("  │  Shown once. Save it now, then change it after your first");
    console.log("  │  sign-in (key icon next to your name in the top bar).");
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log("  │  Generated randomly -- set SEED_ADMIN_PASSWORD to choose one.");
    }
    console.log("  └──────────────────────────────────────────────────────────────");
    console.log("");
  } else {
    console.log(`Admin ${adminEmail} already exists -- password left unchanged.`);
    console.log(`  To set a new one:  npm run reset-password -- ${adminEmail}`);
  }

  // A couple of room types so later steps (rooms, reservations) have something to attach to.
  const single = await prisma.roomType.upsert({
    where: { id: "seed-single" },
    update: {},
    create: { id: "seed-single", name: "Single", baseRate: 3500, capacity: 1 },
  });

  const double = await prisma.roomType.upsert({
    where: { id: "seed-double" },
    update: {},
    create: { id: "seed-double", name: "Double", baseRate: 5500, capacity: 2 },
  });

  await prisma.room.upsert({
    where: { number: "101" },
    update: {},
    create: { number: "101", roomTypeId: single.id },
  });
  await prisma.room.upsert({
    where: { number: "102" },
    update: {},
    create: { number: "102", roomTypeId: double.id },
  });

  console.log("Seeded 2 room types and 2 rooms.");

  // One-time real-room-list migration: rooms 101/102 were placeholder test
  // rooms with made-up tariffs. Clear anything attached to them, then
  // replace with Axis Hotel Nakuru's real 26 rooms across floors 1-4.
  // Rooms 27 and 28 are the only fixed twin-bed rooms; every other room is
  // flexible (Single or Double chosen at check-in), so isTwin marks only
  // those two.
  // Find every room still on the old placeholder tariffs, whatever it's
  // named -- not just 101/102 -- in case anything else got created
  // through the UI while those were still the only types available.
  const oldRooms = await prisma.room.findMany({
    where: { roomTypeId: { in: ["seed-single", "seed-double"] } },
  });
  const oldRoomIds = oldRooms.map((r) => r.id);
  if (oldRooms.length > 0) {
    console.log(`Found ${oldRooms.length} room(s) still on old placeholder tariffs: ${oldRooms.map((r) => r.number).join(", ")}`);
  }

  if (oldRoomIds.length > 0) {
    const oldFolioIds = (
      await prisma.reservationRoom.findMany({
        where: { roomId: { in: oldRoomIds } },
        select: { reservation: { select: { folios: { select: { id: true } } } } },
      })
    ).flatMap((rr) => rr.reservation.folios.map((f) => f.id));

    if (oldFolioIds.length > 0) {
      await prisma.payment.deleteMany({ where: { folioId: { in: oldFolioIds } } });
      await prisma.folioItem.deleteMany({ where: { folioId: { in: oldFolioIds } } });
      await prisma.order.deleteMany({ where: { folioId: { in: oldFolioIds } } });
      await prisma.folio.deleteMany({ where: { id: { in: oldFolioIds } } });
    }

    const oldReservationIds = (
      await prisma.reservationRoom.findMany({
        where: { roomId: { in: oldRoomIds } },
        select: { reservationId: true },
      })
    ).map((rr) => rr.reservationId);

    await prisma.reservationRoom.deleteMany({ where: { roomId: { in: oldRoomIds } } });
    if (oldReservationIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { id: { in: oldReservationIds } } });
    }
    await prisma.housekeepingTask.deleteMany({ where: { roomId: { in: oldRoomIds } } });
    await prisma.maintenanceTicket.deleteMany({ where: { roomId: { in: oldRoomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: oldRoomIds } } });
  }

  await prisma.roomType.deleteMany({ where: { id: { in: ["seed-single", "seed-double"] } } });

  // Fix the mislabeled tariff: it was seeded as "Triple" (capacity 3), but
  // it's really the Twin-bed tariff for rooms 27 & 28 (capacity 2).
  await prisma.roomType.update({
    where: { id: "tariff-triple-bo" },
    data: { name: "Twin — Bed Only", capacity: 2 },
  });
  await prisma.roomType.update({
    where: { id: "tariff-triple-bb" },
    data: { name: "Twin — B&B", capacity: 2 },
  });

  const floors: { prefix: string; numbers: string[]; floor: string }[] = [
    { prefix: "", numbers: ["01", "02", "03", "04", "05", "06", "07", "08"], floor: "1" },
    { prefix: "", numbers: ["21", "22", "23", "24", "25", "26", "27", "28"], floor: "2" },
    { prefix: "", numbers: ["31", "32", "33", "34", "35", "36", "37", "38"], floor: "3" },
    { prefix: "", numbers: ["41", "43"], floor: "4" },
  ];

  let realRoomCount = 0;
  for (const group of floors) {
    for (const num of group.numbers) {
      const isTwin = num === "27" || num === "28";
      await prisma.room.upsert({
        where: { number: num },
        update: { isTwin, floor: group.floor },
        create: {
          number: num,
          floor: group.floor,
          isTwin,
          roomTypeId: isTwin ? "tariff-triple-bo" : "tariff-single-bo",
        },
      });
      realRoomCount++;
    }
  }
  console.log(`Seeded the real ${realRoomCount}-room list across floors 1-4 (rooms 27 & 28 flagged as Twin).`);

  const methods = ["Cash", "M-Pesa", "Card", "Bank Transfer"];
  for (const name of methods) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded payment methods: ${methods.join(", ")}`);

  // Axis Hotel Nakuru's real tariff card: occupancy crossed with meal plan.
  const tariffs: {
    id: string;
    name: string;
    baseRate: number;
    capacity: number;
    mealPlan: "BED_ONLY" | "BED_AND_BREAKFAST";
  }[] = [
    { id: "tariff-single-bo", name: "Single — Bed Only", baseRate: 2000, capacity: 1, mealPlan: "BED_ONLY" },
    { id: "tariff-single-bb", name: "Single — B&B", baseRate: 2400, capacity: 1, mealPlan: "BED_AND_BREAKFAST" },
    { id: "tariff-double-bo", name: "Double — Bed Only", baseRate: 2500, capacity: 2, mealPlan: "BED_ONLY" },
    { id: "tariff-double-bb", name: "Double — B&B", baseRate: 3300, capacity: 2, mealPlan: "BED_AND_BREAKFAST" },
    { id: "tariff-triple-bo", name: "Triple — Bed Only", baseRate: 3000, capacity: 3, mealPlan: "BED_ONLY" },
    { id: "tariff-triple-bb", name: "Triple — B&B", baseRate: 3800, capacity: 3, mealPlan: "BED_AND_BREAKFAST" },
  ];
  for (const t of tariffs) {
    await prisma.roomType.upsert({
      where: { id: t.id },
      update: { baseRate: t.baseRate, mealPlan: t.mealPlan, capacity: t.capacity },
      create: t,
    });
  }
  console.log("Seeded the 6 real Axis Hotel tariff room types (Single/Double/Triple x Bed Only/B&B).");

  // A small starter menu so the Restaurant POS has something to sell.
  const menu: Record<string, { name: string; price: number }[]> = {
    Breakfast: [
      { name: "English Breakfast", price: 650 },
      { name: "Pancakes", price: 400 },
    ],
    Lunch: [
      { name: "Beef Stew & Ugali", price: 550 },
      { name: "Grilled Chicken & Chips", price: 700 },
    ],
    Dinner: [],
    "Ala carte": [],
    Drinks: [
      { name: "Soda", price: 100 },
      { name: "Fresh Juice", price: 200 },
      { name: "Coffee", price: 150 },
    ],
  };
  for (const [categoryName, items] of Object.entries(menu)) {
    const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const categoryId = `seed-cat-${categorySlug}`;
    const category = await prisma.menuCategory.upsert({
      where: { id: categoryId },
      update: { name: categoryName },
      create: { id: categoryId, name: categoryName },
    });
    for (const item of items) {
      const id = `seed-item-${categorySlug}-${item.name.toLowerCase().replace(/\s+/g, "-")}`;
      await prisma.menuItem.upsert({
        where: { id },
        update: {},
        create: { id, categoryId: category.id, name: item.name, price: item.price },
      });
    }
  }
  console.log("Seeded a starter restaurant menu.");
  
  // Realistic Kenyan hotel inventory. Everything is tracked in one base
  // unit (g / ml / pcs) so the recipe engine never has to guess a
  // conversion — see lib/inventory.ts for the display formatting.
  const inventory: {
    id: string;
    sku: string;
    name: string;
    category: string;
    unit: "g" | "ml" | "pcs";
    currentStock: number;
    reorderLevel: number;
    costPerUnit: number;
    supplier?: string;
  }[] = [
    { id: "inv-maize-flour", sku: "INV-001", name: "Maize Flour", category: "Dry Goods", unit: "g", currentStock: 50000, reorderLevel: 10000, costPerUnit: 0.15, supplier: "XYZ Foods" },
    { id: "inv-rice", sku: "INV-002", name: "Rice", category: "Dry Goods", unit: "g", currentStock: 40000, reorderLevel: 8000, costPerUnit: 0.18, supplier: "XYZ Foods" },
    { id: "inv-cooking-oil", sku: "INV-003", name: "Cooking Oil", category: "Dry Goods", unit: "ml", currentStock: 20000, reorderLevel: 4000, costPerUnit: 0.3, supplier: "Bidco Distributors" },
    { id: "inv-eggs", sku: "INV-004", name: "Eggs", category: "Perishables", unit: "pcs", currentStock: 180, reorderLevel: 36, costPerUnit: 15, supplier: "Nakuru Farm Fresh" },
    { id: "inv-sausages", sku: "INV-005", name: "Sausages", category: "Perishables", unit: "pcs", currentStock: 100, reorderLevel: 20, costPerUnit: 40, supplier: "Farmers Choice" },
    { id: "inv-milk", sku: "INV-006", name: "Milk", category: "Perishables", unit: "ml", currentStock: 30000, reorderLevel: 6000, costPerUnit: 0.12, supplier: "Brookside" },
    { id: "inv-sugar", sku: "INV-007", name: "Sugar", category: "Dry Goods", unit: "g", currentStock: 15000, reorderLevel: 3000, costPerUnit: 0.18, supplier: "Mumias Sugar" },
    { id: "inv-tea-leaves", sku: "INV-008", name: "Tea Leaves", category: "Dry Goods", unit: "g", currentStock: 5000, reorderLevel: 1000, costPerUnit: 0.8, supplier: "Ketepa" },
    { id: "inv-chicken", sku: "INV-009", name: "Chicken", category: "Perishables", unit: "g", currentStock: 25000, reorderLevel: 5000, costPerUnit: 0.6, supplier: "Kenchic" },
    { id: "inv-beef", sku: "INV-010", name: "Beef", category: "Perishables", unit: "g", currentStock: 30000, reorderLevel: 6000, costPerUnit: 0.65, supplier: "Nakuru Butchery" },
    { id: "inv-potatoes", sku: "INV-011", name: "Potatoes", category: "Vegetables", unit: "g", currentStock: 50000, reorderLevel: 10000, costPerUnit: 0.08, supplier: "Nakuru Market" },
    { id: "inv-tomatoes", sku: "INV-012", name: "Tomatoes", category: "Vegetables", unit: "g", currentStock: 20000, reorderLevel: 4000, costPerUnit: 0.1, supplier: "Nakuru Market" },
    { id: "inv-onions", sku: "INV-013", name: "Onions", category: "Vegetables", unit: "g", currentStock: 15000, reorderLevel: 3000, costPerUnit: 0.09, supplier: "Nakuru Market" },
    { id: "inv-bread", sku: "INV-014", name: "Bread", category: "Bakery", unit: "pcs", currentStock: 200, reorderLevel: 40, costPerUnit: 10, supplier: "Supa Bakery" },
    { id: "inv-butter", sku: "INV-015", name: "Butter", category: "Dairy", unit: "g", currentStock: 3000, reorderLevel: 600, costPerUnit: 0.7, supplier: "Brookside" },
  ];
  for (const i of inventory) {
    await prisma.inventoryItem.upsert({
      where: { id: i.id },
      update: {},
      create: i,
    });
  }
  console.log(`Seeded ${inventory.length} inventory items.`);

  // Recipes linking three of the seeded menu items to their ingredients,
  // so the automatic consumption engine has something real to demonstrate
  // the moment a sale is rung up in the Restaurant POS.
  const recipes: { menuItemId: string; portions: number; ingredients: { inventoryItemId: string; quantity: number }[] }[] = [
    {
      menuItemId: "seed-item-breakfast-english-breakfast",
      portions: 1,
      ingredients: [
        { inventoryItemId: "inv-eggs", quantity: 1 },
        { inventoryItemId: "inv-sausages", quantity: 1 },
        { inventoryItemId: "inv-bread", quantity: 2 },
        { inventoryItemId: "inv-butter", quantity: 10 },
        { inventoryItemId: "inv-tea-leaves", quantity: 5 },
        { inventoryItemId: "inv-milk", quantity: 50 },
        { inventoryItemId: "inv-sugar", quantity: 10 },
      ],
    },
    {
      menuItemId: "seed-item-lunch-beef-stew-&-ugali",
      portions: 1,
      ingredients: [
        { inventoryItemId: "inv-maize-flour", quantity: 500 },
        { inventoryItemId: "inv-beef", quantity: 200 },
        { inventoryItemId: "inv-tomatoes", quantity: 100 },
        { inventoryItemId: "inv-onions", quantity: 50 },
        { inventoryItemId: "inv-cooking-oil", quantity: 20 },
      ],
    },
    {
      menuItemId: "seed-item-lunch-grilled-chicken-&-chips",
      portions: 1,
      ingredients: [
        { inventoryItemId: "inv-chicken", quantity: 250 },
        { inventoryItemId: "inv-potatoes", quantity: 300 },
        { inventoryItemId: "inv-cooking-oil", quantity: 30 },
      ],
    },
  ];
  for (const r of recipes) {
    const menuItem = await prisma.menuItem.findUnique({ where: { id: r.menuItemId } });
    if (!menuItem) continue; // menu item id changed or wasn't seeded — skip safely
    const existing = await prisma.recipe.findUnique({ where: { menuItemId: r.menuItemId } });
    if (existing) continue; // don't duplicate on re-seed
    await prisma.recipe.create({
      data: {
        menuItemId: r.menuItemId,
        portions: r.portions,
        ingredients: { create: r.ingredients },
      },
    });
  }
  console.log("Seeded recipes for English Breakfast, Beef Stew & Ugali, and Grilled Chicken & Chips.");
  console.log(`Admin user id: ${admin?.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
