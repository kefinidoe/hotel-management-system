-- Index the filters and joins used on every Restaurant POS and Front Desk
-- dashboard load. These are additive indexes and do not alter business data.
CREATE INDEX "Reservation_status_checkInDate_idx"
ON "Reservation"("status", "checkInDate");

CREATE INDEX "Reservation_status_checkOutDate_idx"
ON "Reservation"("status", "checkOutDate");

CREATE INDEX "Folio_isClosed_idx"
ON "Folio"("isClosed");

CREATE INDEX "Folio_reservationId_idx"
ON "Folio"("reservationId");

CREATE INDEX "FolioItem_type_createdAt_idx"
ON "FolioItem"("type", "createdAt");

CREATE INDEX "MenuItem_categoryId_isActive_idx"
ON "MenuItem"("categoryId", "isActive");
