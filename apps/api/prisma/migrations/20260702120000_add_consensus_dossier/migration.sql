-- Research dossier: long-term durability note + source-backed "Umsteiger"
-- switch alternatives on the external consensus. Orientation only — never
-- part of the Wudly Signal.
ALTER TABLE "ExternalConsensus" ADD COLUMN "longTermNote" TEXT;
ALTER TABLE "ExternalConsensus" ADD COLUMN "switchAlternatives" JSONB NOT NULL DEFAULT '[]';
