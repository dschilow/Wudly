-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN "pulseEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PulseEmailLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PulseEmailLog_profileId_dedupeKey_key" ON "PulseEmailLog"("profileId", "dedupeKey");

-- CreateIndex
CREATE INDEX "PulseEmailLog_profileId_kind_sentAt_idx" ON "PulseEmailLog"("profileId", "kind", "sentAt");

-- AddForeignKey
ALTER TABLE "PulseEmailLog" ADD CONSTRAINT "PulseEmailLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
