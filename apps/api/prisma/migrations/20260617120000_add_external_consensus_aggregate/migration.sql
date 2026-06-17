-- Cached "Netz-Konsens" aggregate on the insight snapshot so product cards can show
-- an external-rating summary without joining ExternalRating per render. These are
-- external facts only and never feed the Wudly Signal.
ALTER TABLE "ProductInsightSnapshot"
  ADD COLUMN "externalAvgPercent" INTEGER,
  ADD COLUMN "externalSourceCount" INTEGER NOT NULL DEFAULT 0;
