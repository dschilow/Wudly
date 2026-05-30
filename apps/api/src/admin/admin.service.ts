import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { MergeCandidateDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInsightsService } from '../products/product-insights.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: ProductInsightsService,
  ) {}

  async listMergeCandidates(status: 'PENDING' | 'ALL' = 'PENDING'): Promise<MergeCandidateDto[]> {
    const candidates = await this.prisma.adminMergeCandidate.findMany({
      where: status === 'PENDING' ? { status: 'PENDING' } : {},
      include: {
        productA: { include: PRODUCT_INCLUDE },
        productB: { include: PRODUCT_INCLUDE },
      },
      orderBy: [{ status: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }],
    });
    return candidates.map((c) => ({
      id: c.id,
      productA: toProductSummaryDto(c.productA as ProductWithRelations),
      productB: toProductSummaryDto(c.productB as ProductWithRelations),
      score: c.score,
      reason: c.reason,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Merge product B into product A: re-point all of B's data to A, alias B→A,
   * mark B as MERGED, then recompute A's snapshot. Wrapped in a transaction so a
   * partial merge can never leave the catalog inconsistent.
   */
  async merge(candidateId: string): Promise<{ canonicalProductId: string }> {
    const candidate = await this.prisma.adminMergeCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Merge-Kandidat nicht gefunden.');
    if (candidate.status !== 'PENDING') {
      throw new BadRequestException('Dieser Kandidat wurde bereits bearbeitet.');
    }

    // Keep the older product as canonical (lower id after stable sort in creation).
    const canonicalId = candidate.productAId;
    const mergedId = candidate.productBId;

    await this.prisma.$transaction(async (tx) => {
      await tx.experienceReport.updateMany({
        where: { productId: mergedId },
        data: { productId: canonicalId },
      });
      await tx.productAnswer.updateMany({
        where: { productId: mergedId },
        data: { productId: canonicalId },
      });
      await tx.productQuestion.updateMany({
        where: { productId: mergedId },
        data: { productId: canonicalId },
      });
      // Ownerships have a unique (userId, productId); move only those that won't collide.
      const ownerships = await tx.ownership.findMany({ where: { productId: mergedId } });
      for (const o of ownerships) {
        const exists = await tx.ownership.findUnique({
          where: { userId_productId: { userId: o.userId, productId: canonicalId } },
        });
        if (exists) {
          await tx.ownership.delete({ where: { id: o.id } });
        } else {
          await tx.ownership.update({
            where: { id: o.id },
            data: { productId: canonicalId },
          });
        }
      }

      await tx.productAlias.create({
        data: {
          oldProductId: mergedId,
          canonicalProductId: canonicalId,
          reason: `Merged via admin (candidate ${candidateId})`,
        },
      });
      await tx.product.update({ where: { id: mergedId }, data: { status: 'MERGED' } });
      await tx.adminMergeCandidate.update({
        where: { id: candidateId },
        data: { status: 'MERGED', resolvedAt: new Date() },
      });
    });

    await this.insights.regenerate(canonicalId);
    return { canonicalProductId: canonicalId };
  }

  async reject(candidateId: string): Promise<{ success: true }> {
    const candidate = await this.prisma.adminMergeCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException('Merge-Kandidat nicht gefunden.');
    await this.prisma.adminMergeCandidate.update({
      where: { id: candidateId },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });
    return { success: true };
  }
}
