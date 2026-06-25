CREATE TABLE "ExternalConsensus" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "summary" TEXT,
    "positiveThemes" JSONB NOT NULL DEFAULT '[]',
    "negativeThemes" JSONB NOT NULL DEFAULT '[]',
    "sourceUrls" JSONB NOT NULL DEFAULT '[]',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalConsensus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalConsensus_productId_key" ON "ExternalConsensus"("productId");
CREATE INDEX "ExternalConsensus_fetchedAt_idx" ON "ExternalConsensus"("fetchedAt");
ALTER TABLE "ExternalConsensus" ADD CONSTRAINT "ExternalConsensus_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
