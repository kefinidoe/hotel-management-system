-- Preserve who was accountable for each wastage event separately from the
-- manager who recorded it. Both fields are nullable so existing history
-- remains valid; the API requires accountability for every new record.
ALTER TABLE "Wastage"
ADD COLUMN "accountableUserId" TEXT,
ADD COLUMN "accountableName" TEXT;

CREATE INDEX "Wastage_accountableUserId_idx" ON "Wastage"("accountableUserId");

ALTER TABLE "Wastage"
ADD CONSTRAINT "Wastage_accountableUserId_fkey"
FOREIGN KEY ("accountableUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
