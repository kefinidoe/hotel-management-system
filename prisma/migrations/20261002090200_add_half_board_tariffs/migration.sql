-- Half Board nightly rates for Axis Hotel Nakuru.
-- Separate migration from the enum change above on purpose: PostgreSQL cannot
-- use a new enum value in the same transaction that created it.
--
-- ON CONFLICT DO NOTHING means a price edited in the Rooms screen is never
-- overwritten by a later deploy.
INSERT INTO "RoomType" ("id", "name", "baseRate", "capacity", "mealPlan", "amenities", "createdAt", "updatedAt")
VALUES
  ('tariff-single-hb', 'Single — Half Board', 3400, 1, 'HALF_BOARD', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tariff-double-hb', 'Double — Half Board', 5300, 2, 'HALF_BOARD', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tariff-triple-hb', 'Twin — Half Board',   5800, 2, 'HALF_BOARD', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
