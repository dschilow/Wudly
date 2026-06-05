-- CreateTable
CREATE TABLE "QuickVote" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "value" "WouldBuyAgain" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickVote_productId_idx" ON "QuickVote"("productId");

-- CreateIndex
CREATE INDEX "QuickVote_userId_idx" ON "QuickVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickVote_productId_userId_key" ON "QuickVote"("productId", "userId");

-- AddForeignKey
ALTER TABLE "QuickVote" ADD CONSTRAINT "QuickVote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickVote" ADD CONSTRAINT "QuickVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
