-- Browser-extension product sightings. One row per real-world product (deduped
-- via dedupeKey); repeat views bump seenCount so the table doubles as a demand
-- ranking for the staged (cost-bounded) enrichment pipeline. No user/install
-- identifiers are stored: sightings are anonymous by design.
CREATE TYPE "SightingStatus" AS ENUM ('PENDING', 'MATCHED', 'CREATED', 'RESEARCHED', 'REJECTED');

CREATE TABLE "ProductSighting" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "identifierType" "ProductIdentifierType",
    "identifierValue" TEXT,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "domain" TEXT NOT NULL,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "engageCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SightingStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT,
    "lastError" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "ProductSighting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductSighting_dedupeKey_key" ON "ProductSighting"("dedupeKey");
CREATE INDEX "ProductSighting_status_lastSeenAt_idx" ON "ProductSighting"("status", "lastSeenAt");
CREATE INDEX "ProductSighting_productId_idx" ON "ProductSighting"("productId");
ALTER TABLE "ProductSighting" ADD CONSTRAINT "ProductSighting_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
