-- AlterTable
ALTER TABLE "ProductInsightSnapshot" ADD COLUMN     "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiHeadline" TEXT,
ADD COLUMN     "aiNotSuitedFor" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "aiSuitedFor" JSONB NOT NULL DEFAULT '[]';
