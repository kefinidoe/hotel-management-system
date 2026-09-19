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
