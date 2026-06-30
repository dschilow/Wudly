-- CreateEnum
CREATE TYPE "ProductPromptStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "promptsGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductPrompt" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "quickAnswers" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductPromptStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPromptResponse" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceReportId" TEXT,
    "answerLabel" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPromptResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPrompt_productId_status_idx" ON "ProductPrompt"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductPromptResponse_promptId_idx" ON "ProductPromptResponse"("promptId");

-- CreateIndex
CREATE INDEX "ProductPromptResponse_productId_idx" ON "ProductPromptResponse"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPromptResponse_promptId_userId_key" ON "ProductPromptResponse"("promptId", "userId");

-- AddForeignKey
ALTER TABLE "ProductPrompt" ADD CONSTRAINT "ProductPrompt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPromptResponse" ADD CONSTRAINT "ProductPromptResponse_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ProductPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPromptResponse" ADD CONSTRAINT "ProductPromptResponse_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPromptResponse" ADD CONSTRAINT "ProductPromptResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPromptResponse" ADD CONSTRAINT "ProductPromptResponse_experienceReportId_fkey" FOREIGN KEY ("experienceReportId") REFERENCES "ExperienceReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
