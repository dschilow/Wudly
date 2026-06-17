import { randomBytes } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type {
  InviteRatingInput,
  RatingInviteDto,
  PublicInviteDto,
  InvitedVoteDto,
  InvitedVotesSummaryDto,
} from '@wudly/shared';
import type { InvitedVote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInsightsService } from '../products/product-insights.service';

function toInvitedVoteDto(v: InvitedVote): InvitedVoteDto {
  return {
    id: v.id,
    productId: v.productId,
    guestName: v.guestName,
    wouldBuyAgain: v.wouldBuyAgain as InvitedVoteDto['wouldBuyAgain'],
    comment: v.comment,
    claimed: v.claimedByUserId != null,
    createdAt: v.createdAt.toISOString(),
  };
}

/**
 * Invite-to-rate: an owner shares a link, an acquaintance rates the product with
 * no account. Guest votes are stored marked + weighted down; once the guest logs
 * in or registers they can be claimed (upgraded to a full vote).
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: ProductInsightsService,
  ) {}

  async createInvite(productId: string, userId: string): Promise<RatingInviteDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const token = randomBytes(9).toString('base64url');
    const invite = await this.prisma.ratingInvite.create({
      data: {
        token,
        productId,
        inviterUserId: userId,
        maxUses: 50,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return {
      token: invite.token,
      url: `/e/${invite.token}`,
      productId,
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async getPublicInvite(token: string): Promise<PublicInviteDto> {
    const invite = await this.prisma.ratingInvite.findUnique({
      where: { token },
      include: {
        product: { select: { id: true, canonicalName: true, brand: true, imageUrl: true } },
        inviter: { select: { displayName: true } },
      },
    });
    if (!invite) throw new NotFoundException('Einladung nicht gefunden.');
    return {
      token: invite.token,
      active: this.isActive(invite.expiresAt, invite.uses, invite.maxUses),
      inviterName: invite.inviter?.displayName ?? null,
      product: {
        id: invite.product.id,
        canonicalName: invite.product.canonicalName,
        brand: invite.product.brand,
        imageUrl: invite.product.imageUrl,
      },
    };
  }

  async submitRating(token: string, input: InviteRatingInput): Promise<InvitedVoteDto> {
    const invite = await this.prisma.ratingInvite.findUnique({
      where: { token },
      select: { id: true, productId: true, expiresAt: true, uses: true, maxUses: true },
    });
    if (!invite) throw new NotFoundException('Einladung nicht gefunden.');
    if (!this.isActive(invite.expiresAt, invite.uses, invite.maxUses)) {
      throw new BadRequestException('Diese Einladung ist nicht mehr gültig.');
    }

    const vote = await this.prisma.invitedVote.create({
      data: {
        inviteId: invite.id,
        productId: invite.productId,
        guestName: input.guestName?.trim() || null,
        wouldBuyAgain: input.wouldBuyAgain,
        comment: input.comment?.trim() || null,
      },
    });
    await this.prisma.ratingInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });
    void this.insights.regenerate(invite.productId).catch(() => {});
    return toInvitedVoteDto(vote);
  }

  async listForProduct(productId: string): Promise<InvitedVotesSummaryDto> {
    const votes = await this.prisma.invitedVote.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      count: votes.length,
      yesCount: votes.filter((v) => v.wouldBuyAgain === 'YES').length,
      votes: votes.map(toInvitedVoteDto),
    };
  }

  /**
   * Upgrade a guest's invited votes to full account votes after they authenticate,
   * and make them a real owner of the product — so they join the owner pool: their
   * voice counts fully and they can be asked questions like any other owner.
   */
  async claim(token: string, userId: string): Promise<{ claimed: number }> {
    const invite = await this.prisma.ratingInvite.findUnique({
      where: { token },
      select: { id: true, productId: true },
    });
    if (!invite) return { claimed: 0 };
    const res = await this.prisma.invitedVote.updateMany({
      where: { inviteId: invite.id, claimedByUserId: null },
      data: { claimedByUserId: userId, weight: 1 },
    });
    if (res.count > 0) {
      await this.prisma.ownership.upsert({
        where: { userId_productId: { userId, productId: invite.productId } },
        create: { userId, productId: invite.productId },
        update: {},
      });
      void this.insights.regenerate(invite.productId).catch(() => {});
    }
    return { claimed: res.count };
  }

  private isActive(expiresAt: Date | null, uses: number, maxUses: number): boolean {
    if (expiresAt && expiresAt.getTime() < Date.now()) return false;
    return uses < maxUses;
  }
}
