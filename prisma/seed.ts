import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@hotel.com" },
    update: {},
    create: {
      name: "Hotel Admin",
      email: "admin@hotel.com",
      passwordHash,
      role: RoleName.ADMIN,
      department: "Management",
    },
  });

  console.log("Seeded admin login:");
  console.log("  email:    admin@hotel.com");
  console.log("  password: Admin123!");

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
  console.log("Reassign rooms 101/102/107 to the correct new type on the Rooms page, then delete the old generic Single/Double types there.");

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
    Drinks: [
      { name: "Soda", price: 100 },
      { name: "Fresh Juice", price: 200 },
      { name: "Coffee", price: 150 },
    ],
  };
  for (const [categoryName, items] of Object.entries(menu)) {
    const category = await prisma.menuCategory.upsert({
      where: { id: `seed-cat-${categoryName.toLowerCase()}` },
      update: {},
      create: { id: `seed-cat-${categoryName.toLowerCase()}`, name: categoryName },
    });
    for (const item of items) {
      const id = `seed-item-${categoryName.toLowerCase()}-${item.name.toLowerCase().replace(/\s+/g, "-")}`;
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
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
