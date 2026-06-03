import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import {
  normalizeProductName,
  guessBrand,
  AI_SERVICE,
  DEFAULT_SIMILARITY_THRESHOLDS,
  type AiService,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductSummaryDto,
  type ProductDetailDto,
  type CreateProductResultDto,
  type PaginatedDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductInsightsService } from './product-insights.service';
import { renderProductPreviewSvg } from './product-preview-svg';
import { renderProductShareSvg } from './product-share-svg';
import {
  toProductSummaryDto,
  toProductDetailDto,
  type ProductWithRelations,
} from './product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: ProductMatchingService,
    private readonly insights: ProductInsightsService,
    @Inject(AI_SERVICE) private readonly ai: AiService,
  ) {}

  async list(take: number, skip: number): Promise<PaginatedDto<ProductSummaryDto>> {
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        include: PRODUCT_INCLUDE,
        orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
    ]);
    return {
      items: rows.map(toProductSummaryDto),
      total,
      take,
      skip,
    };
  }

  async search(query: string, take: number): Promise<ProductSummaryDto[]> {
    const candidates = await this.matching.search(query, take);
    return candidates.map((c) => toProductSummaryDto(c.product));
  }

  async getDetail(id: string): Promise<ProductDetailDto> {
    const product = await this.findOrThrow(id);
    const insights = await this.insights.getInsights(id);
    return toProductDetailDto(product, insights);
  }

  /** AI-suggested (or curated-fallback) questions a buyer might ask owners. */
  async suggestQuestions(id: string): Promise<string[]> {
    await this.findOrThrow(id);
    try {
      return await this.ai.suggestQuestions(id);
    } catch (err) {
      this.logger.warn(`Question suggestion failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  async getSummaryOrThrow(id: string): Promise<ProductSummaryDto> {
    const product = await this.findOrThrow(id);
    return toProductSummaryDto(product);
  }

  async getPreviewSvgByNormalizedName(normalizedName: string): Promise<string> {
    const product = await this.prisma.product.findFirst({
      where: {
        normalizedName,
        status: { in: ['ACTIVE', 'PENDING_REVIEW'] },
      },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Produkt nicht gefunden.');
    }

    return renderProductPreviewSvg(product);
  }

  /** Generated preview SVG addressed by product id (stable, used by the UI thumbnails). */
  async getPreviewSvgById(id: string): Promise<string> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product || product.status === 'HIDDEN') {
      throw new NotFoundException('Produkt nicht gefunden.');
    }
    return renderProductPreviewSvg(product);
  }

  /** 1200×630 social share card (rebuy score + product) addressed by product id. */
  async getShareSvgById(id: string): Promise<string> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, insightSnapshot: true },
    });
    if (!product || product.status === 'HIDDEN') {
      throw new NotFoundException('Produkt nicht gefunden.');
    }
    return renderProductShareSvg({
      canonicalName: product.canonicalName,
      brand: product.brand,
      category: product.category ? { name: product.category.name } : null,
      rebuyScore: product.insightSnapshot?.rebuyScore ?? null,
      experienceCount: product.insightSnapshot?.experienceCount ?? 0,
    });
  }

  /**
   * Create a product with duplicate protection:
   *  - If a near-identical product exists and the caller didn't force, return
   *    candidates instead of creating ("did you mean…?").
   *  - Otherwise create it. If a borderline (not strong) match exists, also log
   *    an AdminMergeCandidate for later human review.
   */
  async create(input: CreateProductInput): Promise<CreateProductResultDto> {
    const canonicalName = input.canonicalName.trim();
    const normalizedName = normalizeProductName(canonicalName);

    if (!input.forceCreate) {
      const candidates = await this.matching.findDuplicateCandidates(canonicalName, 5);
      const strong = candidates.find(
        (c) => c.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate,
      );
      if (strong || candidates.length > 0) {
        return {
          created: false,
          reason: 'possible_duplicates',
          candidates: candidates.map((c) => ({
            product: toProductSummaryDto(c.product),
            similarity: Number(c.similarity.toFixed(2)),
          })),
        };
      }
    }

    // Resolve brand + category — enrich with AI when the user left them blank.
    let brand = input.brand ?? guessBrand(canonicalName);
    let categorySlug = input.categorySlug;
    if (!brand || !categorySlug) {
      const enriched = await this.enrichWithAi(canonicalName, categorySlug);
      brand = brand ?? enriched.brand;
      categorySlug = categorySlug ?? enriched.categorySlug;
    }
    const categoryId = categorySlug ? await this.resolveCategoryId(categorySlug) : null;

    const product = await this.prisma.product.create({
      data: {
        canonicalName,
        normalizedName,
        brand: brand ?? null,
        categoryId,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        status: 'ACTIVE',
        sources: {
          create: {
            sourceType: 'USER_SUBMITTED',
            rawTitle: canonicalName,
            matchConfidence: 0,
          },
        },
      },
      include: PRODUCT_INCLUDE,
    });

    // If forced through despite a borderline match, record it for admin review.
    if (input.forceCreate) {
      await this.maybeLogMergeCandidate(product, canonicalName);
    }

    // Create an (empty) snapshot so the product reads consistently from the start.
    const insights = await this.insights.regenerate(product.id);
    return { created: true, product: toProductDetailDto(product, insights) };
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductDetailDto> {
    await this.findOrThrow(id);
    const categoryId =
      input.categorySlug !== undefined
        ? await this.resolveCategoryId(input.categorySlug)
        : undefined;

    const data: Record<string, unknown> = {};
    if (input.canonicalName !== undefined) {
      data.canonicalName = input.canonicalName.trim();
      data.normalizedName = normalizeProductName(input.canonicalName);
    }
    if (input.brand !== undefined) data.brand = input.brand;
    if (input.description !== undefined) data.description = input.description;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (categoryId !== undefined) data.categoryId = categoryId;

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: PRODUCT_INCLUDE,
    });
    const insights = await this.insights.getInsights(id);
    return toProductDetailDto(product, insights);
  }

  private async findOrThrow(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product || product.status === 'HIDDEN') {
      throw new NotFoundException('Produkt nicht gefunden.');
    }
    return product;
  }

  private async resolveCategoryId(slug: string): Promise<string | null> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    return category?.id ?? null;
  }

  /**
   * Best-effort AI enrichment of brand + category for a new product. Only accepts
   * a categorySlug the AI returns if it actually exists. Never throws (the dummy
   * provider already gives a safe brand guess via the fallback).
   */
  private async enrichWithAi(
    rawName: string,
    categoryHint?: string,
  ): Promise<{ brand?: string; categorySlug?: string }> {
    try {
      const candidate = await this.ai.extractProductCandidate({ rawName, categoryHint });
      let categorySlug: string | undefined;
      if (candidate.categorySlug) {
        const exists = await this.prisma.category.findUnique({
          where: { slug: candidate.categorySlug },
          select: { slug: true },
        });
        categorySlug = exists?.slug;
      }
      return { brand: candidate.brand, categorySlug };
    } catch (err) {
      this.logger.warn(`AI product enrichment failed: ${err instanceof Error ? err.message : err}`);
      return {};
    }
  }

  private async maybeLogMergeCandidate(
    created: ProductWithRelations,
    name: string,
  ): Promise<void> {
    const candidates = await this.matching.findDuplicateCandidates(name, 1);
    const top = candidates.find((c) => c.product.id !== created.id);
    if (!top) return;

    // Store with a stable ordering of the pair to satisfy the unique constraint.
    const [a, b] = [created.id, top.product.id].sort();
    await this.prisma.adminMergeCandidate
      .create({
        data: {
          productAId: a!,
          productBId: b!,
          score: Number(top.similarity.toFixed(2)),
          reason: `Auto-detected on create: "${name}" ~ "${top.product.canonicalName}"`,
        },
      })
      .catch(() => {
        // Pair already flagged — ignore the unique-constraint conflict.
      });
  }
}
