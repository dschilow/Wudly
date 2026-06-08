-- Wudly Showcase: professional creator / brand product presentation.
-- This content is clearly-labelled commercial material and never feeds the
-- neutral Wudly Signal score or the rankings.

-- CreateEnum
CREATE TYPE "ProfessionalProfileType" AS ENUM ('CREATOR', 'INFLUENCER', 'BRAND', 'MERCHANT', 'TESTER');

-- CreateEnum
CREATE TYPE "ShowcaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShowcaseBlockType" AS ENUM (
  'HERO', 'PROMISE', 'AUDIENCE', 'GALLERY', 'FEATURE_CARDS', 'USE_CASES',
  'PROBLEM_SOLUTION', 'COMPARISON', 'CHART', 'FAQ', 'VIDEO', 'CREATOR_VERDICT',
  'BRAND_STATEMENT', 'TECH_SPECS', 'BUY_LINK', 'AFFILIATE_NOTE', 'DOWNLOADS',
  'CTA', 'DISCLOSURE'
);

-- CreateEnum
CREATE TYPE "DisclosureType" AS ENUM (
  'SELF_BOUGHT', 'FREE_PRODUCT', 'PAID_PARTNERSHIP', 'AFFILIATE',
  'MANUFACTURER', 'MERCHANT', 'INDEPENDENT_TEST', 'WUDLY_NATIVE'
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProfessionalProfileType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bio" TEXT,
    "websiteUrl" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'SELF_DECLARED',
    "paidPartnerships" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductShowcase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "status" "ShowcaseStatus" NOT NULL DEFAULT 'DRAFT',
    "disclosureType" "DisclosureType" NOT NULL,
    "affiliateDisclosure" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowcaseBlock" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "type" "ShowcaseBlockType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTemplate" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_slug_key" ON "ProfessionalProfile"("slug");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_type_idx" ON "ProfessionalProfile"("type");

-- CreateIndex
CREATE INDEX "ProductShowcase_productId_status_idx" ON "ProductShowcase"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductShowcase_profileId_idx" ON "ProductShowcase"("profileId");

-- CreateIndex
CREATE INDEX "ShowcaseBlock_showcaseId_sortOrder_idx" ON "ShowcaseBlock"("showcaseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTemplate_slug_key" ON "ProductTemplate"("slug");

-- CreateIndex
CREATE INDEX "ProductTemplate_categoryId_idx" ON "ProductTemplate"("categoryId");

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductShowcase" ADD CONSTRAINT "ProductShowcase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductShowcase" ADD CONSTRAINT "ProductShowcase_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcaseBlock" ADD CONSTRAINT "ShowcaseBlock_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "ProductShowcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTemplate" ADD CONSTRAINT "ProductTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
