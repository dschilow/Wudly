import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildInsightSnapshot,
  type InsightExperienceInput,
  type ProductInsightsDto,
  type AspectSentiment,
} from '@wudly/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toProductInsightsDto } from './product.mapper';

/**
 * Computes and persists ProductInsightSnapshot rows.
 *
 * MVP: regenerated synchronously whenever an experience is created. The pure
 * aggregation lives in `@wudly/shared` (buildInsightSnapshot), so this service is
 * just the I/O shell: load experiences + owner count → compute → upsert snapshot.
 * Moving this behind a queue/worker later only changes *where* it's called.
 */
@Injectable()
export class ProductInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recompute and upsert the snapshot for a product. Returns the DTO. */
  async regenerate(productId: string): Promise<ProductInsightsDto> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    // Aggregate over PUBLIC experiences only — private ones never affect scores.
    const reports = await this.prisma.experienceReport.findMany({
      where: { productId, isPublic: true },
      include: {
        aspects: true,
        product: { select: { categoryId: true } },
      },
    });

    // Resolve aspect labels via the product's category aspect vocabulary.
    const labelByKey = await this.aspectLabelMap(product.categoryId);

    const inputs: InsightExperienceInput[] = reports.map((report) => ({
      wouldBuyAgain: report.wouldBuyAgain,
      usageDuration: report.usageDuration,
      experienceMood: report.experienceMood,
      wishKnownText: report.wishKnownText,
      aspects: report.aspects.map((a) => ({
        key: a.aspectKey,
        label: labelByKey.get(a.aspectKey) ?? a.aspectKey,
        sentiment: a.sentiment as AspectSentiment,
      })),
    }));

    const ownerCount = await this.prisma.ownership.count({ where: { productId } });
    const snapshot = buildInsightSnapshot(inputs, ownerCount);

    const persisted = await this.prisma.productInsightSnapshot.upsert({
      where: { productId },
      create: {
        productId,
        ownerCount: snapshot.ownerCount,
        experienceCount: snapshot.experienceCount,
        rebuyScore: snapshot.rebuyScore,
        regretScore: snapshot.regretScore,
        unsureScore: snapshot.unsureScore,
        topPositiveAspects: snapshot.topPositiveAspects as unknown as Prisma.InputJsonValue,
        topNegativeAspects: snapshot.topNegativeAspects as unknown as Prisma.InputJsonValue,
        wishKnownHighlights: snapshot.wishKnownHighlights as unknown as Prisma.InputJsonValue,
        usageDurationStats: snapshot.usageDurationStats as unknown as Prisma.InputJsonValue,
      },
      update: {
        ownerCount: snapshot.ownerCount,
        experienceCount: snapshot.experienceCount,
        rebuyScore: snapshot.rebuyScore,
        regretScore: snapshot.regretScore,
        unsureScore: snapshot.unsureScore,
        topPositiveAspects: snapshot.topPositiveAspects as unknown as Prisma.InputJsonValue,
        topNegativeAspects: snapshot.topNegativeAspects as unknown as Prisma.InputJsonValue,
        wishKnownHighlights: snapshot.wishKnownHighlights as unknown as Prisma.InputJsonValue,
        usageDurationStats: snapshot.usageDurationStats as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
    });

    const dto = toProductInsightsDto(productId, persisted);
    // The derived audience hints are not persisted in the MVP; attach live.
    dto.suitedFor = snapshot.suitedFor;
    dto.notSuitedFor = snapshot.notSuitedFor;
    return dto;
  }

  /** Read the current snapshot DTO, regenerating audience hints on the fly. */
  async getInsights(productId: string): Promise<ProductInsightsDto> {
    const snap = await this.prisma.productInsightSnapshot.findUnique({ where: { productId } });
    if (!snap) {
      // No snapshot yet → compute one so the first read is still meaningful.
      const exists = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Produkt nicht gefunden.');
      return this.regenerate(productId);
    }
    const dto = toProductInsightsDto(productId, snap);
    const audience = await this.deriveAudienceLive(productId);
    dto.suitedFor = audience.suitedFor;
    dto.notSuitedFor = audience.notSuitedFor;
    return dto;
  }

  private async aspectLabelMap(categoryId: string | null): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!categoryId) return map;
    const aspects = await this.prisma.categoryAspect.findMany({ where: { categoryId } });
    for (const a of aspects) map.set(a.key, a.label);
    return map;
  }

  private async deriveAudienceLive(
    productId: string,
  ): Promise<{ suitedFor: string[]; notSuitedFor: string[] }> {
    const reports = await this.prisma.experienceReport.findMany({
      where: { productId, isPublic: true },
      select: {
        wouldBuyAgain: true,
        usageDuration: true,
        experienceMood: true,
        wishKnownText: true,
      },
    });
    const inputs: InsightExperienceInput[] = reports.map((r) => ({ ...r, aspects: [] }));
    const ownerCount = await this.prisma.ownership.count({ where: { productId } });
    const snap = buildInsightSnapshot(inputs, ownerCount);
    return { suitedFor: snap.suitedFor, notSuitedFor: snap.notSuitedFor };
  }
}
