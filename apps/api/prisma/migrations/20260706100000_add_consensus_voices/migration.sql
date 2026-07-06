-- Paraphrased per-source takeaways ("Stimmen aus dem Netz") on the external
-- consensus: [{sourceLabel, url, sentiment: PRO|CONTRA|MIXED, text}].
ALTER TABLE "ExternalConsensus" ADD COLUMN "voices" JSONB NOT NULL DEFAULT '[]';
