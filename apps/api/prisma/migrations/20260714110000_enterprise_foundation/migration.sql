CREATE TYPE "OwnershipVerificationMethod" AS ENUM ('CONTINUITY', 'MODERATOR');

CREATE TYPE "FunnelEvent" AS ENUM (
  'SEARCH_PERFORMED',
  'RESEARCH_STARTED',
  'RESEARCH_SUCCEEDED',
  'RESEARCH_NO_MATCH',
  'OWNERSHIP_CREATED',
  'EXPERIENCE_CREATED',
  'EXPERIENCE_UPDATED',
  'QUESTION_CREATED',
  'ANSWER_CREATED'
);

ALTER TABLE "Ownership"
  ADD COLUMN "verificationMethod" "OwnershipVerificationMethod",
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

UPDATE "Ownership"
SET
  "verificationMethod" = 'MODERATOR',
  "verifiedAt" = COALESCE("updatedAt", "createdAt")
WHERE "verificationStatus" = 'VERIFIED';

CREATE TABLE "ExperienceRevision" (
  "id" TEXT NOT NULL,
  "experienceReportId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "wouldBuyAgain" "WouldBuyAgain" NOT NULL,
  "usageDuration" "UsageDuration" NOT NULL,
  "experienceMood" "ExperienceMood" NOT NULL,
  "isPublic" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperienceRevision_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ExperienceRevision" (
  "id",
  "experienceReportId",
  "fingerprint",
  "wouldBuyAgain",
  "usageDuration",
  "experienceMood",
  "isPublic",
  "createdAt"
)
SELECT
  CONCAT('legacy_', MD5("id")),
  "id",
  CONCAT('legacy:', "id"),
  "wouldBuyAgain",
  "usageDuration",
  "experienceMood",
  "isPublic",
  "createdAt"
FROM "ExperienceReport";

CREATE UNIQUE INDEX "ExperienceRevision_experienceReportId_fingerprint_key"
  ON "ExperienceRevision"("experienceReportId", "fingerprint");
CREATE INDEX "ExperienceRevision_experienceReportId_createdAt_idx"
  ON "ExperienceRevision"("experienceReportId", "createdAt");

ALTER TABLE "ExperienceRevision"
  ADD CONSTRAINT "ExperienceRevision_experienceReportId_fkey"
  FOREIGN KEY ("experienceReportId") REFERENCES "ExperienceReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

CREATE TABLE "FunnelMetricDaily" (
  "id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "event" "FunnelEvent" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FunnelMetricDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FunnelMetricDaily_day_event_key"
  ON "FunnelMetricDaily"("day", "event");
CREATE INDEX "FunnelMetricDaily_day_idx" ON "FunnelMetricDaily"("day");
