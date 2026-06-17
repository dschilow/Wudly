-- CreateTable
CREATE TABLE "RatingInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inviterUserId" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitedVote" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT,
    "productId" TEXT NOT NULL,
    "guestName" TEXT,
    "wouldBuyAgain" "WouldBuyAgain" NOT NULL,
    "comment" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitedVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RatingInvite_token_key" ON "RatingInvite"("token");

-- CreateIndex
CREATE INDEX "RatingInvite_productId_idx" ON "RatingInvite"("productId");

-- CreateIndex
CREATE INDEX "RatingInvite_inviterUserId_idx" ON "RatingInvite"("inviterUserId");

-- CreateIndex
CREATE INDEX "InvitedVote_productId_idx" ON "InvitedVote"("productId");

-- CreateIndex
CREATE INDEX "InvitedVote_inviteId_idx" ON "InvitedVote"("inviteId");

-- CreateIndex
CREATE INDEX "InvitedVote_claimedByUserId_idx" ON "InvitedVote"("claimedByUserId");

-- AddForeignKey
ALTER TABLE "RatingInvite" ADD CONSTRAINT "RatingInvite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingInvite" ADD CONSTRAINT "RatingInvite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitedVote" ADD CONSTRAINT "InvitedVote_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "RatingInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitedVote" ADD CONSTRAINT "InvitedVote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitedVote" ADD CONSTRAINT "InvitedVote_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
