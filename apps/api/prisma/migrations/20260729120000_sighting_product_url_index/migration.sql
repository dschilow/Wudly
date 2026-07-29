-- The shop product URL is the most stable identity a product page has: it
-- survives marketing title rewrites AND changes to how the extension
-- identifies a product (a page reported by article number today may report its
-- GTIN tomorrow — a different dedupeKey, therefore a different sighting row).
-- The sightings service uses it as the last resolution path, so that a product
-- the pipeline already built is never queued a second time.
CREATE INDEX "ProductSighting_productUrl_idx" ON "ProductSighting"("productUrl");
