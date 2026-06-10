-- External rating facts ("Bewertungen anderswo") + cached product images.

-- CreateEnum
CREATE TYPE "ExternalRatingKind" AS ENUM ('STARS', 'PERCENT', 'GRADE_DE');

-- CreateTable
CREATE TABLE "ExternalRating" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "ExternalRatingKind" NOT NULL DEFAULT 'STARS',
    "value" DOUBLE PRECISION NOT NULL,
    "maxValue" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "count" INTEGER,
    "note" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sourceUrl" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalRating_productId_idx" ON "ExternalRating"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRating_productId_source_key" ON "ExternalRating"("productId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_key" ON "ProductImage"("productId");

-- AddForeignKey
ALTER TABLE "ExternalRating" ADD CONSTRAINT "ExternalRating_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
