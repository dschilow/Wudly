import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  MergeCandidateDto,
  CatalogQualityOverviewDto,
  FunnelOverviewDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInsightsService } from '../products/product-insights.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';
import { ProductsService } from '../products/products.service';
import { calculateCatalogQuality, countDistinctSourceDomains } from '../products/catalog-quality';
import { FunnelMetricsService } from '../metrics/funnel-metrics.service';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductInsightsService) private readonly insights: ProductInsightsService,
    @Inject(ProductsService) private readonly products: ProductsService,
    @Inject(FunnelMetricsService) private readonly metrics: FunnelMetricsService,
  ) {}

  async catalogQuality(): Promise<CatalogQualityOverviewDto> {
    const rows = await this.prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] } },
      select: {
        id: true,
        canonicalName: true,
        status: true,
        brand: true,
        categoryId: true,
        description: true,
        specs: true,
        imageUrl: true,
        createdAt: true,
        cachedImage: { select: { id: true } },
        insightSnapshot: {
          select: { externalSourceCount: true, experienceCount: true },
        },
        externalRatings: { select: { url: true } },
        externalConsensus: { select: { sourceUrls: true } },
        _count: { select: { experienceReports: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map((product) => {
      const urls = new Set(product.externalRatings.map((rating) => rating.url));
      if (Array.isArray(product.externalConsensus?.sourceUrls)) {
        for (const value of product.externalConsensus.sourceUrls) {
          if (typeof value === 'string') urls.add(value);
        }
      }
      return calculateCatalogQuality({
        productId: product.id,
        canonicalName: product.canonicalName,
        status: product.status,
        brand: product.brand,
        categoryId: product.categoryId,
        description: product.description,
        specs: product.specs,
        hasImage: Boolean(product.cachedImage || product.imageUrl),
        sourceCount: Math.max(
          product.insightSnapshot?.externalSourceCount ?? 0,
          countDistinctSourceDomains(urls),
        ),
        experienceCount: Math.max(
          product.insightSnapshot?.experienceCount ?? 0,
          product._count.experienceReports,
        ),
        createdAt: product.createdAt,
      });
    });
    items.sort(
      (a, b) =>
        Number(b.status === 'PENDING_REVIEW') - Number(a.status === 'PENDING_REVIEW') ||
        a.score - b.score ||
        b.createdAt.localeCompare(a.createdAt),
    );

    return {
      activeProducts: items.filter((item) => item.status === 'ACTIVE').length,
      pendingProducts: items.filter((item) => item.status === 'PENDING_REVIEW').length,
      criticalProducts: items.filter((item) =>
        item.issues.some((issue) => issue.severity === 'CRITICAL'),
      ).length,
      averageScore:
        items.length > 0
          ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length)
          : 0,
      items,
    };
  }

  async publishProduct(productId: string): Promise<{ success: true }> {
    const quality = await this.products.catalogQualityForProduct(productId);
    if (!quality.publishReady) {
      throw new BadRequestException(
        'Das Produkt hat noch nicht genug belastbare Informationen oder Quellen.',
      );
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { status: 'ACTIVE' },
    });
    return { success: true };
  }

  async holdProduct(productId: string): Promise<{ success: true }> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { status: 'PENDING_REVIEW' },
    });
    return { success: true };
  }

  async hideProduct(productId: string): Promise<{ success: true }> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { status: 'HIDDEN' },
    });
    return { success: true };
  }

  funnelOverview(days = 14): Promise<FunnelOverviewDto> {
    return this.metrics.overview(days);
  }

  private async mergeVariants(
    tx: Prisma.TransactionClient,
    canonicalId: string,
    mergedId: string,
  ): Promise<void> {
    const variants = await tx.productVariant.findMany({ where: { productId: mergedId } });
    for (const variant of variants) {
      const existing = await tx.productVariant.findFirst({
        where: { productId: canonicalId, name: variant.name },
      });
      if (!existing) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { productId: canonicalId },
        });
        continue;
      }
      await tx.ownership.updateMany({
        where: { variantId: variant.id },
        data: { variantId: existing.id },
      });
      await tx.experienceReport.updateMany({
        where: { variantId: variant.id },
        data: { variantId: existing.id },
      });
      await tx.productIdentifier.updateMany({
        where: { variantId: variant.id },
        data: { variantId: existing.id },
      });
      await tx.productVariant.delete({ where: { id: variant.id } });
    }
  }

  private async mergeOwnerships(
    tx: Prisma.TransactionClient,
    canonicalId: string,
    mergedId: string,
  ): Promise<void> {
    const trustRank: Record<string, number> = { VERIFIED: 3, SELF_DECLARED: 2, UNVERIFIED: 1 };
    const ownerships = await tx.ownership.findMany({ where: { productId: mergedId } });
    for (const ownership of ownerships) {
      const existing = await tx.ownership.findUnique({
        where: { userId_productId: { userId: ownership.userId, productId: canonicalId } },
      });
      if (!existing) {
        await tx.ownership.update({
          where: { id: ownership.id },
          data: { productId: canonicalId },
        });
        continue;
      }
      if (
        (trustRank[ownership.verificationStatus] ?? 0) >
        (trustRank[existing.verificationStatus] ?? 0)
      ) {
        await tx.ownership.update({
          where: { id: existing.id },
          data: {
            verificationStatus: ownership.verificationStatus,
            verificationMethod: ownership.verificationMethod,
            verifiedAt: ownership.verifiedAt,
          },
        });
      }
      await tx.experienceReport.updateMany({
        where: { ownershipId: ownership.id },
        data: { ownershipId: existing.id },
      });
      await tx.productAnswer.updateMany({
        where: { ownershipId: ownership.id },
        data: { ownershipId: existing.id },
      });
      // The merged checkpoints change this owner's journey: let the companion
      // scanner re-plan it on its next pass.
      await tx.ownership.update({
        where: { id: existing.id },
        data: { nextCheckInAt: new Date() },
      });
      await tx.ownership.delete({ where: { id: ownership.id } });
    }
  }

  private async mergeExperienceReports(
    tx: Prisma.TransactionClient,
    canonicalId: string,
    mergedId: string,
  ): Promise<void> {
    const reports = await tx.experienceReport.findMany({
      where: { productId: mergedId },
      include: { aspects: true, revisions: true },
    });
    for (const report of reports) {
      const existing = await tx.experienceReport.findUnique({
        where: { userId_productId: { userId: report.userId, productId: canonicalId } },
      });
      if (!existing) {
        await tx.experienceReport.update({
          where: { id: report.id },
          data: { productId: canonicalId },
        });
        continue;
      }

      if (report.revisions.length > 0) {
        await tx.experienceRevision.createMany({
          data: report.revisions.map((revision) => ({
            experienceReportId: existing.id,
            fingerprint: revision.fingerprint,
            wouldBuyAgain: revision.wouldBuyAgain,
            usageDuration: revision.usageDuration,
            experienceMood: revision.experienceMood,
            isPublic: revision.isPublic,
            createdAt: revision.createdAt,
          })),
          skipDuplicates: true,
        });
      }
      await tx.productPromptResponse.updateMany({
        where: { experienceReportId: report.id },
        data: { experienceReportId: existing.id },
      });

      if (report.updatedAt > existing.updatedAt) {
        await tx.experienceReport.update({
          where: { id: existing.id },
          data: {
            variantId: report.variantId,
            ownershipId: report.ownershipId,
            wouldBuyAgain: report.wouldBuyAgain,
            usageDuration: report.usageDuration,
            experienceMood: report.experienceMood,
            wishKnownText: report.wishKnownText,
            freeText: report.freeText,
            insteadOfText: report.insteadOfText,
            isPublic: report.isPublic,
          },
        });
        await tx.experienceAspect.deleteMany({
          where: { experienceReportId: existing.id },
        });
        if (report.aspects.length > 0) {
          await tx.experienceAspect.createMany({
            data: report.aspects.map((aspect) => ({
              experienceReportId: existing.id,
              aspectKey: aspect.aspectKey,
              sentiment: aspect.sentiment,
              severity: aspect.severity,
              createdAt: aspect.createdAt,
            })),
          });
        }
      }
      await tx.experienceReport.delete({ where: { id: report.id } });
    }
  }

  private async mergeQuickVotes(
    tx: Prisma.TransactionClient,
    canonicalId: string,
    mergedId: string,
  ): Promise<void> {
    const votes = await tx.quickVote.findMany({ where: { productId: mergedId } });
    for (const vote of votes) {
      if (!vote.userId) {
        await tx.quickVote.update({
          where: { id: vote.id },
          data: { productId: canonicalId },
        });
        continue;
      }
      const existing = await tx.quickVote.findUnique({
        where: { productId_userId: { productId: canonicalId, userId: vote.userId } },
      });
      if (!existing) {
        await tx.quickVote.update({
          where: { id: vote.id },
          data: { productId: canonicalId },
        });
        continue;
      }
      if (vote.createdAt > existing.createdAt) {
        await tx.quickVote.update({
          where: { id: existing.id },
          data: { value: vote.value, tags: vote.tags },
        });
      }
      await tx.quickVote.delete({ where: { id: vote.id } });
    }
  }

  private async mergeExternalResearch(
    tx: Prisma.TransactionClient,
    canonicalId: string,
    mergedId: string,
  ): Promise<void> {
    const ratings = await tx.externalRating.findMany({ where: { productId: mergedId } });
    for (const rating of ratings) {
      const existing = await tx.externalRating.findUnique({
        where: { productId_source: { productId: canonicalId, source: rating.source } },
      });
      if (!existing) {
        await tx.externalRating.update({
          where: { id: rating.id },
          data: { productId: canonicalId },
        });
        continue;
      }
      if (rating.fetchedAt > existing.fetchedAt) {
        await tx.externalRating.update({
          where: { id: existing.id },
          data: {
            sourceLabel: rating.sourceLabel,
            url: rating.url,
            kind: rating.kind,
            value: rating.value,
            maxValue: rating.maxValue,
            count: rating.count,
            note: rating.note,
            fetchedAt: rating.fetchedAt,
          },
        });
      }
      await tx.externalRating.delete({ where: { id: rating.id } });
    }

    const [canonicalConsensus, mergedConsensus] = await Promise.all([
      tx.externalConsensus.findUnique({ where: { productId: canonicalId } }),
      tx.externalConsensus.findUnique({ where: { productId: mergedId } }),
    ]);
    if (mergedConsensus && !canonicalConsensus) {
      await tx.externalConsensus.update({
        where: { id: mergedConsensus.id },
        data: { productId: canonicalId },
      });
    } else if (mergedConsensus && canonicalConsensus) {
      if (mergedConsensus.fetchedAt > canonicalConsensus.fetchedAt) {
        await tx.externalConsensus.update({
          where: { id: canonicalConsensus.id },
          data: {
            summary: mergedConsensus.summary,
            longTermNote: mergedConsensus.longTermNote,
            positiveThemes: mergedConsensus.positiveThemes as Prisma.InputJsonValue,
            negativeThemes: mergedConsensus.negativeThemes as Prisma.InputJsonValue,
            voices: mergedConsensus.voices as Prisma.InputJsonValue,
            switchAlternatives: mergedConsensus.switchAlternatives as Prisma.InputJsonValue,
            sourceUrls: mergedConsensus.sourceUrls as Prisma.InputJsonValue,
            fetchedAt: mergedConsensus.fetchedAt,
          },
        });
      }
      await tx.externalConsensus.delete({ where: { id: mergedConsensus.id } });
    }

    const [canonicalImage, mergedImage] = await Promise.all([
      tx.productImage.findUnique({ where: { productId: canonicalId } }),
      tx.productImage.findUnique({ where: { productId: mergedId } }),
    ]);
    if (mergedImage && !canonicalImage) {
      await tx.productImage.update({
        where: { id: mergedImage.id },
        data: { productId: canonicalId },
      });
    } else if (mergedImage && canonicalImage) {
      if (mergedImage.updatedAt > canonicalImage.updatedAt) {
        await tx.productImage.update({
          where: { id: canonicalImage.id },
          data: {
            mime: mergedImage.mime,
            bytes: mergedImage.bytes,
            sourceUrl: mergedImage.sourceUrl,
            source: mergedImage.source,
          },
        });
      }
      await tx.productImage.delete({ where: { id: mergedImage.id } });
    }
  }

  private async mergePulseReferences(
    tx: Prisma.TransactionClient,
    canonicalId: string,
    mergedId: string,
  ): Promise<void> {
    const competitorLinks = await tx.pulseCompetitor.findMany({
      where: { competitorProductId: mergedId },
    });
    for (const link of competitorLinks) {
      const duplicate = await tx.pulseCompetitor.findUnique({
        where: {
          watchId_competitorProductId: {
            watchId: link.watchId,
            competitorProductId: canonicalId,
          },
        },
      });
      if (duplicate) {
        await tx.pulseCompetitor.delete({ where: { id: link.id } });
      } else {
        await tx.pulseCompetitor.update({
          where: { id: link.id },
          data: { competitorProductId: canonicalId },
        });
      }
    }

    const watches = await tx.pulseWatch.findMany({ where: { productId: mergedId } });
    for (const watch of watches) {
      const existing = await tx.pulseWatch.findUnique({
        where: { profileId_productId: { profileId: watch.profileId, productId: canonicalId } },
      });
      if (!existing) {
        await tx.pulseWatch.update({
          where: { id: watch.id },
          data: { productId: canonicalId },
        });
        continue;
      }
      const links = await tx.pulseCompetitor.findMany({ where: { watchId: watch.id } });
      for (const link of links) {
        if (link.competitorProductId === canonicalId) {
          await tx.pulseCompetitor.delete({ where: { id: link.id } });
          continue;
        }
        const duplicate = await tx.pulseCompetitor.findUnique({
          where: {
            watchId_competitorProductId: {
              watchId: existing.id,
              competitorProductId: link.competitorProductId,
            },
          },
        });
        if (duplicate) {
          await tx.pulseCompetitor.delete({ where: { id: link.id } });
        } else {
          await tx.pulseCompetitor.update({
            where: { id: link.id },
            data: { watchId: existing.id },
          });
        }
      }
      await tx.pulseWatch.delete({ where: { id: watch.id } });
    }
  }

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
      const [canonical, merged] = await Promise.all([
        tx.product.findUnique({ where: { id: canonicalId } }),
        tx.product.findUnique({ where: { id: mergedId } }),
      ]);
      if (!canonical || !merged) {
        throw new NotFoundException('Eines der Produkte existiert nicht mehr.');
      }

      const canonicalSpecs = Array.isArray(canonical.specs) ? canonical.specs : [];
      await tx.product.update({
        where: { id: canonicalId },
        data: {
          brand: canonical.brand ?? merged.brand,
          categoryId: canonical.categoryId ?? merged.categoryId,
          description: canonical.description ?? merged.description,
          imageUrl: canonical.imageUrl ?? merged.imageUrl,
          specs: (canonicalSpecs.length > 0
            ? canonical.specs
            : merged.specs) as Prisma.InputJsonValue,
          promptsGeneratedAt: canonical.promptsGeneratedAt ?? merged.promptsGeneratedAt,
        },
      });

      // Resolve unique-key collisions before moving the remaining relations.
      await this.mergeVariants(tx, canonicalId, mergedId);
      await this.mergeOwnerships(tx, canonicalId, mergedId);
      await this.mergeExperienceReports(tx, canonicalId, mergedId);
      await this.mergeQuickVotes(tx, canonicalId, mergedId);
      await this.mergeExternalResearch(tx, canonicalId, mergedId);
      await this.mergePulseReferences(tx, canonicalId, mergedId);

      await Promise.all([
        tx.productAnswer.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productQuestion.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.notification.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productIdentifier.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productSource.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productSighting.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productPrompt.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productPromptResponse.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.ratingInvite.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.invitedVote.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.productShowcase.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.pulseAction.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
        tx.pulseChange.updateMany({
          where: { productId: mergedId },
          data: { productId: canonicalId },
        }),
      ]);

      // The snapshot is derived and is rebuilt after commit.
      await tx.productInsightSnapshot.deleteMany({ where: { productId: mergedId } });
      await tx.productAlias.updateMany({
        where: { canonicalProductId: mergedId },
        data: { canonicalProductId: canonicalId },
      });
      await tx.productAlias.upsert({
        where: { oldProductId: mergedId },
        create: {
          oldProductId: mergedId,
          canonicalProductId: canonicalId,
          reason: `Merged via admin (candidate ${candidateId})`,
        },
        update: {
          canonicalProductId: canonicalId,
          reason: `Merged via admin (candidate ${candidateId})`,
        },
      });

      const resolvedAt = new Date();
      await tx.adminMergeCandidate.updateMany({
        where: {
          id: { not: candidateId },
          status: 'PENDING',
          OR: [{ productAId: mergedId }, { productBId: mergedId }],
        },
        data: { status: 'REJECTED', resolvedAt },
      });
      await tx.product.update({ where: { id: mergedId }, data: { status: 'MERGED' } });
      await tx.adminMergeCandidate.update({
        where: { id: candidateId },
        data: { status: 'MERGED', resolvedAt },
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
