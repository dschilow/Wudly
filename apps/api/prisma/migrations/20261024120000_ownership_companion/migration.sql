-- Ownership companion ("Besitz-Begleiter"): owners are accompanied through
-- check-ins after 1 month, 6 months, 1 year and 2 years of real use instead of
-- a single 6-month reminder.

CREATE TYPE "OwnershipEndReason" AS ENUM ('BROKEN', 'REPLACED', 'SOLD', 'RETURNED', 'OTHER');

ALTER TABLE "Ownership"
  ADD COLUMN "ownedSince" TIMESTAMP(3),
  ADD COLUMN "nextCheckInAt" TIMESTAMP(3),
  ADD COLUMN "snoozedUntil" TIMESTAMP(3),
  ADD COLUMN "checkInsMutedAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "endReason" "OwnershipEndReason";

CREATE INDEX "Ownership_nextCheckInAt_idx" ON "Ownership"("nextCheckInAt");

-- Conservative start of use: the earliest of registration and what every
-- recorded verdict implies (the lower bound of its usage bucket). Mirrors
-- `estimateStartOfUse` in @wudly/shared.
WITH implied AS (
  SELECT o."id",
         rv."createdAt" - (CASE rv."usageDuration"
           WHEN 'LESS_THAN_WEEK' THEN 0
           WHEN 'ONE_TO_FOUR_WEEKS' THEN 7
           WHEN 'ONE_TO_SIX_MONTHS' THEN 30
           WHEN 'SIX_TO_TWELVE_MONTHS' THEN 182
           ELSE 365
         END) * INTERVAL '1 day' AS "startedAt"
  FROM "ExperienceRevision" rv
  JOIN "ExperienceReport" er ON er."id" = rv."experienceReportId"
  JOIN "Ownership" o ON o."userId" = er."userId" AND o."productId" = er."productId"
  UNION ALL
  SELECT o."id",
         er."updatedAt" - (CASE er."usageDuration"
           WHEN 'LESS_THAN_WEEK' THEN 0
           WHEN 'ONE_TO_FOUR_WEEKS' THEN 7
           WHEN 'ONE_TO_SIX_MONTHS' THEN 30
           WHEN 'SIX_TO_TWELVE_MONTHS' THEN 182
           ELSE 365
         END) * INTERVAL '1 day'
  FROM "ExperienceReport" er
  JOIN "Ownership" o ON o."userId" = er."userId" AND o."productId" = er."productId"
)
UPDATE "Ownership" o
SET "ownedSince" = LEAST(o."createdAt", i."startedAt")
FROM (SELECT "id", MIN("startedAt") AS "startedAt" FROM implied GROUP BY "id") i
WHERE i."id" = o."id";

UPDATE "Ownership" SET "ownedSince" = "createdAt" WHERE "ownedSince" IS NULL;

-- Let the reminder scanner plan every existing ownership once with the exact
-- milestone logic: due check-ins get one nudge (never repeating a reminder that
-- already went out for the same milestone), everything else is re-scheduled.
UPDATE "Ownership" SET "nextCheckInAt" = NOW();
