import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import {
  AspectSentiment,
  AI_SERVICE,
  type AiService,
  type CreateExperienceInput,
  type ExperienceDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInsightsService } from '../products/product-insights.service';
import { toExperienceDto, type ExperienceWithRelations } from './experience.mapper';

const EXPERIENCE_INCLUDE = {
  aspects: true,
  user: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class ExperiencesService {
  private readonly logger = new Logger(ExperiencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: ProductInsightsService,
    @Inject(AI_SERVICE) private readonly ai: AiService,
  ) {}

  /**
   * Records a "Ich besitze es" experience. Ensures an Ownership exists (the act
   * of reporting an experience implies ownership), persists aspects, then
   * synchronously regenerates the product's insight snapshot (MVP behavior).
   */
  async create(
    productId: string,
    userId: string,
    input: CreateExperienceInput,
  ): Promise<ExperienceDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const ownership = await this.prisma.ownership.upsert({
      where: { userId_productId: { userId, productId } },
      create: {
        userId,
        productId,
        variantId: input.variantId ?? null,
        verificationStatus: 'SELF_DECLARED',
      },
      update: {},
    });

    const positiveKeys = new Map<string, string>();
    const negativeKeys = new Map<string, string>();
    for (const key of input.positiveAspects ?? []) positiveKeys.set(key, key);
    for (const key of input.negativeAspects ?? []) negativeKeys.set(key, key);

    // Enrich with AI-extracted aspects from the free text (best-effort, never fatal).
    // Only when there's enough text and the user didn't already tag a lot.
    const totalTagged = positiveKeys.size + negativeKeys.size;
    if (input.freeText && input.freeText.trim().length >= 12 && totalTagged < 6) {
      try {
        const extracted = await this.ai.normalizeExperienceText(input.freeText);
        for (const a of extracted.positiveAspects) {
          if (!negativeKeys.has(a.key)) positiveKeys.set(a.key, a.key);
        }
        for (const a of extracted.negativeAspects) {
          if (!positiveKeys.has(a.key)) negativeKeys.set(a.key, a.key);
        }
      } catch (err) {
        this.logger.warn(`AI aspect extraction failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    const aspectData = [
      ...[...positiveKeys.keys()].map((key) => ({
        aspectKey: key,
        sentiment: AspectSentiment.POSITIVE,
      })),
      ...[...negativeKeys.keys()].map((key) => ({
        aspectKey: key,
        sentiment: AspectSentiment.NEGATIVE,
      })),
    ];

    const report = await this.prisma.experienceReport.create({
      data: {
        userId,
        productId,
        ownershipId: ownership.id,
        variantId: input.variantId ?? null,
        wouldBuyAgain: input.wouldBuyAgain,
        usageDuration: input.usageDuration,
        experienceMood: input.experienceMood,
        wishKnownText: input.wishKnownText ?? null,
        freeText: input.freeText ?? null,
        isPublic: input.isPublic,
        aspects: { create: aspectData },
      },
      include: EXPERIENCE_INCLUDE,
    });

    // Keep scores fresh. Synchronous in the MVP; move to a queue later.
    await this.insights.regenerate(productId);

    const labels = await this.aspectLabelMap(product.categoryId);
    return toExperienceDto(report as ExperienceWithRelations, labels);
  }

  /** Public experiences for a product (newest first). */
  async listForProduct(productId: string): Promise<ExperienceDto[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const reports = await this.prisma.experienceReport.findMany({
      where: { productId, isPublic: true },
      include: EXPERIENCE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const labels = await this.aspectLabelMap(product.categoryId);
    return reports.map((r) => toExperienceDto(r as ExperienceWithRelations, labels));
  }

  /** All experiences authored by the current user (incl. private), newest first. */
  async listForUser(userId: string): Promise<ExperienceDto[]> {
    const reports = await this.prisma.experienceReport.findMany({
      where: { userId },
      include: EXPERIENCE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    // Labels vary per category; resolve lazily per distinct category.
    const labelCache = new Map<string | null, Map<string, string>>();
    const result: ExperienceDto[] = [];
    for (const r of reports) {
      const product = await this.prisma.product.findUnique({
        where: { id: r.productId },
        select: { categoryId: true },
      });
      const catId = product?.categoryId ?? null;
      if (!labelCache.has(catId)) labelCache.set(catId, await this.aspectLabelMap(catId));
      result.push(toExperienceDto(r as ExperienceWithRelations, labelCache.get(catId)!));
    }
    return result;
  }

  private async aspectLabelMap(categoryId: string | null): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!categoryId) return map;
    const aspects = await this.prisma.categoryAspect.findMany({ where: { categoryId } });
    for (const a of aspects) map.set(a.key, a.label);
    return map;
  }
}
