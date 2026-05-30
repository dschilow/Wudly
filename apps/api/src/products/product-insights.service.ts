import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import {
  buildInsightSnapshot,
  AI_SERVICE,
  type AiService,
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
 * Scores/aspects are computed synchronously (pure logic in `@wudly/shared`).
 * The AI summary (headline + suited/not-suited) is generated in the background
 * so submitting an experience stays fast; it's persisted when it returns. If AI
 * is disabled or fails, rule-based audience hints are used as a fallback.
 */
@Injectable()
export class ProductInsightsService {
  private readonly logger = new Logger(ProductInsightsService.name);
  /** Guards against piling up concurrent AI calls for the same product. */
  private readonly aiInFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_SERVICE) private readonly ai: AiService,
  ) {}

  /** Recompute and upsert the snapshot for a product. Returns the DTO. */
  async regenerate(productId: string): Promise<ProductInsightsDto> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    // Aggregate over PUBLIC experiences only — private ones never affect scores.
    const reports = await this.prisma.experienceReport.findMany({
      where: { productId, isPublic: true },
      include: { aspects: true },
    });

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

    const data = {
      ownerCount: snapshot.ownerCount,
      experienceCount: snapshot.experienceCount,
      rebuyScore: snapshot.rebuyScore,
      regretScore: snapshot.regretScore,
      unsureScore: snapshot.unsureScore,
      topPositiveAspects: snapshot.topPositiveAspects as unknown as Prisma.InputJsonValue,
      topNegativeAspects: snapshot.topNegativeAspects as unknown as Prisma.InputJsonValue,
      wishKnownHighlights: snapshot.wishKnownHighlights as unknown as Prisma.InputJsonValue,
      usageDurationStats: snapshot.usageDurationStats as unknown as Prisma.InputJsonValue,
    };

    const persisted = await this.prisma.productInsightSnapshot.upsert({
      where: { productId },
      create: { productId, ...data },
      update: { ...data, generatedAt: new Date() },
    });

    const dto = toProductInsightsDto(productId, persisted);
    // If no AI summary persisted yet, overlay the rule-based audience hints so the
    // UI is never empty; and kick off AI generation for next time.
    if (!persisted.aiHeadline) {
      dto.suitedFor = snapshot.suitedFor;
      dto.notSuitedFor = snapshot.notSuitedFor;
    }
    this.refreshAiSummary(productId, snapshot.experienceCount);
    return dto;
  }

  /** Read the current snapshot DTO, regenerating if missing. */
  async getInsights(productId: string): Promise<ProductInsightsDto> {
    const snap = await this.prisma.productInsightSnapshot.findUnique({ where: { productId } });
    if (!snap) {
      const exists = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Produkt nicht gefunden.');
      return this.regenerate(productId);
    }
    const dto = toProductInsightsDto(productId, snap);
    if (!snap.aiHeadline) {
      const audience = await this.deriveAudienceLive(productId);
      dto.suitedFor = audience.suitedFor;
      dto.notSuitedFor = audience.notSuitedFor;
      // Opportunistically generate the AI summary for next load.
      this.refreshAiSummary(productId, snap.experienceCount);
    }
    return dto;
  }

  /**
   * Fire-and-forget AI summary generation. Persists headline + suited/not-suited
   * onto the snapshot. Deduped per product and skipped when there's too little data.
   */
  private refreshAiSummary(productId: string, experienceCount: number): void {
    if (experienceCount < 2 || this.aiInFlight.has(productId)) return;
    this.aiInFlight.add(productId);

    void (async () => {
      try {
        const summary = await this.ai.summarizeProductInsights(productId);
        // Empty headline = no real AI output (e.g. dummy provider); don't persist.
        if (!summary.headline || summary.headline.trim().length === 0) return;
        await this.prisma.productInsightSnapshot.update({
          where: { productId },
          data: {
            aiHeadline: summary.headline,
            aiSuitedFor: summary.suitedFor as unknown as Prisma.InputJsonValue,
            aiNotSuitedFor: summary.notSuitedFor as unknown as Prisma.InputJsonValue,
            aiGeneratedAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(
          `AI summary failed for ${productId}: ${err instanceof Error ? err.message : err}`,
        );
      } finally {
        this.aiInFlight.delete(productId);
      }
    })();
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
