-- Establish the four required Restaurant POS categories with stable IDs.
-- Existing items are preserved: duplicate meal-period categories are merged,
-- and Brunch items are moved into Breakfast before Brunch is removed.
INSERT INTO "MenuCategory" ("id", "name")
VALUES
  ('seed-cat-breakfast', 'Breakfast'),
  ('seed-cat-lunch', 'Lunch'),
  ('seed-cat-dinner', 'Dinner'),
  ('seed-cat-ala-carte', 'Ala carte')
ON CONFLICT ("id") DO NOTHING;

-- Breakfast absorbs duplicate Breakfast categories and all Brunch items.
UPDATE "MenuItem"
SET "categoryId" = 'seed-cat-breakfast'
WHERE "categoryId" IN (
  SELECT "id"
  FROM "MenuCategory"
  WHERE "id" <> 'seed-cat-breakfast'
    AND LOWER(BTRIM("name")) IN ('breakfast', 'brunch')
);
DELETE FROM "MenuCategory"
WHERE "id" <> 'seed-cat-breakfast'
  AND LOWER(BTRIM("name")) IN ('breakfast', 'brunch');
UPDATE "MenuCategory" SET "name" = 'Breakfast' WHERE "id" = 'seed-cat-breakfast';

-- Merge every case/spacing variation of Lunch into one category.
UPDATE "MenuItem"
SET "categoryId" = 'seed-cat-lunch'
WHERE "categoryId" IN (
  SELECT "id"
  FROM "MenuCategory"
  WHERE "id" <> 'seed-cat-lunch'
    AND LOWER(BTRIM("name")) = 'lunch'
);
DELETE FROM "MenuCategory"
WHERE "id" <> 'seed-cat-lunch'
  AND LOWER(BTRIM("name")) = 'lunch';
UPDATE "MenuCategory" SET "name" = 'Lunch' WHERE "id" = 'seed-cat-lunch';

-- Merge duplicate Dinner categories.
UPDATE "MenuItem"
SET "categoryId" = 'seed-cat-dinner'
WHERE "categoryId" IN (
  SELECT "id"
  FROM "MenuCategory"
  WHERE "id" <> 'seed-cat-dinner'
    AND LOWER(BTRIM("name")) = 'dinner'
);
DELETE FROM "MenuCategory"
WHERE "id" <> 'seed-cat-dinner'
  AND LOWER(BTRIM("name")) = 'dinner';
UPDATE "MenuCategory" SET "name" = 'Dinner' WHERE "id" = 'seed-cat-dinner';

-- Normalize common spellings of Ala carte without touching unrelated
-- categories such as Drinks or Desserts.
UPDATE "MenuItem"
SET "categoryId" = 'seed-cat-ala-carte'
WHERE "categoryId" IN (
  SELECT "id"
  FROM "MenuCategory"
  WHERE "id" <> 'seed-cat-ala-carte'
    AND LOWER(BTRIM("name")) IN (
      'ala carte',
      'a la carte',
      'à la carte',
      'ala-carte',
      'a-la-carte'
    )
);
DELETE FROM "MenuCategory"
WHERE "id" <> 'seed-cat-ala-carte'
  AND LOWER(BTRIM("name")) IN (
    'ala carte',
    'a la carte',
    'à la carte',
    'ala-carte',
    'a-la-carte'
  );
UPDATE "MenuCategory" SET "name" = 'Ala carte' WHERE "id" = 'seed-cat-ala-carte';
