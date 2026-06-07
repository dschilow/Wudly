-- 6-month rebuy reminder + comparative regret ("what would you have bought instead").

-- New notification type for the reminder nudge.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REBUY_REMINDER';

-- Track when the reminder was sent so we never re-send it.
ALTER TABLE "Ownership" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Comparative regret free-text field on experiences.
ALTER TABLE "ExperienceReport" ADD COLUMN "insteadOfText" TEXT;

-- Aggregated comparative regret on the snapshot.
ALTER TABLE "ProductInsightSnapshot" ADD COLUMN "insteadOfShare" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductInsightSnapshot" ADD COLUMN "insteadOfHighlights" JSONB NOT NULL DEFAULT '[]';
