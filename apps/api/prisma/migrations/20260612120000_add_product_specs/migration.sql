-- Technical facts gathered from external catalogs (Icecat/UPCitemdb), stored as
-- an order-preserving JSON array of { label, value } pairs.
ALTER TABLE "Product" ADD COLUMN "specs" JSONB NOT NULL DEFAULT '[]';
