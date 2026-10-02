-- Rooms 27 and 28 were flagged as fixed twin-bed rooms, which locked them to a
-- Twin tariff and blocked every other occupancy. Occupancy is now chosen per
-- booking for every room, so the flag goes away and all rooms behave alike.
ALTER TABLE "Room" DROP COLUMN "isTwin";
