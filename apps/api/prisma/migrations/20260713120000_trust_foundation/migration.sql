-- Trust foundation: keep one current experience and answer per user/product
-- pair, attribute owner answers and make helpful votes auditable.

WITH ranked_experiences AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "productId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS position
  FROM "ExperienceReport"
)
DELETE FROM "ExperienceReport"
WHERE id IN (
  SELECT id FROM ranked_experiences WHERE position > 1
);

CREATE UNIQUE INDEX "ExperienceReport_userId_productId_key"
  ON "ExperienceReport"("userId", "productId");

WITH ranked_answers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "questionId", "answeredByUserId"
      ORDER BY "helpfulCount" DESC, "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS position
  FROM "ProductAnswer"
)
DELETE FROM "ProductAnswer"
WHERE id IN (
  SELECT id FROM ranked_answers WHERE position > 1
);

ALTER TABLE "ProductAnswer" ADD COLUMN "ownershipId" TEXT;

UPDATE "ProductAnswer" AS answer
SET "ownershipId" = ownership.id
FROM "Ownership" AS ownership
WHERE ownership."userId" = answer."answeredByUserId"
  AND ownership."productId" = answer."productId";

CREATE UNIQUE INDEX "ProductAnswer_questionId_answeredByUserId_key"
  ON "ProductAnswer"("questionId", "answeredByUserId");
CREATE INDEX "ProductAnswer_ownershipId_idx" ON "ProductAnswer"("ownershipId");

ALTER TABLE "ProductAnswer"
  ADD CONSTRAINT "ProductAnswer_ownershipId_fkey"
  FOREIGN KEY ("ownershipId") REFERENCES "Ownership"(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AnswerHelpfulVote" (
  id TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnswerHelpfulVote_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "AnswerHelpfulVote_answerId_userId_key"
  ON "AnswerHelpfulVote"("answerId", "userId");
CREATE INDEX "AnswerHelpfulVote_userId_idx" ON "AnswerHelpfulVote"("userId");

ALTER TABLE "AnswerHelpfulVote"
  ADD CONSTRAINT "AnswerHelpfulVote_answerId_fkey"
  FOREIGN KEY ("answerId") REFERENCES "ProductAnswer"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnswerHelpfulVote"
  ADD CONSTRAINT "AnswerHelpfulVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
