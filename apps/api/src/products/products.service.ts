import { Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeProductName,
  guessBrand,
  DEFAULT_SIMILARITY_THRESHOLDS,
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
import {
  toProductSummaryDto,
  toProductDetailDto,
  type ProductWithRelations,
} from './product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: ProductMatchingService,
    private readonly insights: ProductInsightsService,
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

  async getSummaryOrThrow(id: string): Promise<ProductSummaryDto> {
    const product = await this.findOrThrow(id);
    return toProductSummaryDto(product);
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

    const categoryId = input.categorySlug
      ? await this.resolveCategoryId(input.categorySlug)
      : null;
    const brand = input.brand ?? guessBrand(canonicalName);

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
