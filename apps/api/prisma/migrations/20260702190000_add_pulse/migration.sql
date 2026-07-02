-- Wudly Pulse — B2B product-health dashboard for brands / merchants.
-- Pulse only READS the neutral signal (experiences, votes, insights); these
-- tables hold what companies own: watchlist + competitor mapping, action board
-- and change log. They never feed the Wudly Signal score or the rankings.

CREATE TYPE "PulseActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED');
CREATE TYPE "PulseActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "PulseChangeType" AS ENUM (
  'FIRMWARE_UPDATE', 'APP_UPDATE', 'NEW_GENERATION', 'NEW_BATCH',
  'SUPPLIER_CHANGE', 'PACKAGING', 'MANUAL_UPDATE', 'SUPPORT_PROCESS',
  'SPARE_PART_PRICING', 'SHOP_LISTING', 'OTHER'
);

CREATE TABLE "PulseWatch" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PulseWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PulseWatch_profileId_productId_key" ON "PulseWatch"("profileId", "productId");
CREATE INDEX "PulseWatch_profileId_idx" ON "PulseWatch"("profileId");
CREATE INDEX "PulseWatch_productId_idx" ON "PulseWatch"("productId");

ALTER TABLE "PulseWatch" ADD CONSTRAINT "PulseWatch_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PulseWatch" ADD CONSTRAINT "PulseWatch_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PulseCompetitor" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "competitorProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PulseCompetitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PulseCompetitor_watchId_competitorProductId_key"
  ON "PulseCompetitor"("watchId", "competitorProductId");
CREATE INDEX "PulseCompetitor_watchId_idx" ON "PulseCompetitor"("watchId");

ALTER TABLE "PulseCompetitor" ADD CONSTRAINT "PulseCompetitor_watchId_fkey"
  FOREIGN KEY ("watchId") REFERENCES "PulseWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PulseCompetitor" ADD CONSTRAINT "PulseCompetitor_competitorProductId_fkey"
  FOREIGN KEY ("competitorProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PulseAction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "triggerSummary" TEXT,
    "triggerKey" TEXT,
    "assignee" TEXT,
    "priority" "PulseActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "PulseActionStatus" NOT NULL DEFAULT 'OPEN',
    "goal" TEXT,
    "expectedImpact" TEXT,
    "dueAt" TIMESTAMP(3),
    "baselineRebuyScore" INTEGER,
    "baselineRegretScore" INTEGER,
    "baselineExperienceCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PulseAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PulseAction_profileId_status_idx" ON "PulseAction"("profileId", "status");
CREATE INDEX "PulseAction_productId_idx" ON "PulseAction"("productId");

ALTER TABLE "PulseAction" ADD CONSTRAINT "PulseAction_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PulseAction" ADD CONSTRAINT "PulseAction_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PulseChange" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "PulseChangeType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PulseChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PulseChange_profileId_productId_idx" ON "PulseChange"("profileId", "productId");
CREATE INDEX "PulseChange_productId_effectiveAt_idx" ON "PulseChange"("productId", "effectiveAt");

ALTER TABLE "PulseChange" ADD CONSTRAINT "PulseChange_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PulseChange" ADD CONSTRAINT "PulseChange_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
