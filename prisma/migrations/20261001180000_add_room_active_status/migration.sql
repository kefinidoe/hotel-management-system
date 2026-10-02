-- Preserve reservation, folio, housekeeping, and maintenance history when a
-- room is removed from the hotel's active inventory.
ALTER TABLE "Room"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
