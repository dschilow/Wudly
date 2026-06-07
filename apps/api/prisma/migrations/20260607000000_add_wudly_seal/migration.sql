-- AlterTable: add the auto-awarded "Wudly-empfohlen" quality seal to snapshots.
ALTER TABLE "ProductInsightSnapshot" ADD COLUMN "wudlySeal" BOOLEAN NOT NULL DEFAULT false;
