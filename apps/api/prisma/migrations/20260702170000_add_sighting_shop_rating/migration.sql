-- Shop rating facts captured from the product page's structured data
-- (schema.org aggregateRating). Stored on the sighting so PENDING rows keep
-- them until a catalog product exists; then applied as an ExternalRating.
ALTER TABLE "ProductSighting" ADD COLUMN "ratingValue" DOUBLE PRECISION;
ALTER TABLE "ProductSighting" ADD COLUMN "ratingMax" DOUBLE PRECISION;
ALTER TABLE "ProductSighting" ADD COLUMN "ratingCount" INTEGER;
