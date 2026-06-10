import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import {
  normalizeProductName,
  guessBrand,
  isExcludedFromRankings,
  AI_SERVICE,
  DEFAULT_SIMILARITY_THRESHOLDS,
  type AiService,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductSummaryDto,
  type ProductDetailDto,
  type CreateProductResultDto,
  type PaginatedDto,
  type IdentifiedProductDto,
  type EanResolutionDto,
  type EnsuredProductDto,
  type FromPhotoInput,
  type RegretCheckDto,
  type RegretCheckInput,
  type QuickVoteInput,
  type QuickVoteResultDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductInsightsService } from './product-insights.service';
import { IcecatService, type EanLookupHit } from './icecat.service';
import { ProductImageService } from './product-image.service';
import { ExternalRatingsService } from './external-ratings.service';
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
    private readonly icecat: IcecatService,
    private readonly images: ProductImageService,
    private readonly externalRatings: ExternalRatingsService,
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
    const [insights, externalRatings] = await Promise.all([
      this.insights.getInsights(id),
      this.externalRatings.listForProduct(id),
    ]);
    return toProductDetailDto(product, insights, externalRatings);
  }

  /**
   * Camera KI fallback: recognize a product from a photo (used only when no
   * barcode could be read). Returns the recognized fields plus a ready-to-use
   * search query. The API key never reaches the client — the call runs here.
   */
  async identify(imageDataUrl: string): Promise<IdentifiedProductDto> {
    let result;
    try {
      result = await this.ai.identifyProductFromImage(imageDataUrl);
    } catch (err) {
      this.logger.warn(`Image identify failed: ${err instanceof Error ? err.message : err}`);
      result = { brand: null, product: null, category: null, confidence: 0 };
    }
    const query = [result.brand, result.product]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join(' ')
      .trim();
    return {
      brand: result.brand,
      product: result.product,
      category: result.category,
      confidence: result.confidence,
      query,
    };
  }

  /**
   * Resolve a scanned barcode to a product. Order: known internal identifier →
   * free EAN databases (Open Food Facts, then UPCitemdb) → **auto-create** the
   * product (so a scan always lands somewhere useful) and remember the EAN.
   */
  async resolveEan(ean: string, userId: string | null = null): Promise<EanResolutionDto> {
    const normalized = ean.trim();
    const identifier = await this.prisma.productIdentifier.findFirst({
      where: { value: normalized, type: { in: ['EAN', 'GTIN'] } },
      include: { product: { include: PRODUCT_INCLUDE } },
    });
    if (identifier?.product && identifier.product.status !== 'HIDDEN') {
      return {
        ean: normalized,
        product: toProductSummaryDto(identifier.product),
        suggestion: null,
      };
    }

    const external = await this.lookupEanExternal(normalized);
    if (external) {
      const { product } = await this.ensureProduct({
        canonicalName: external.title,
        brand: external.brand,
        imageUrl: external.image,
        imageSource: external.source,
        ean: normalized,
        userId,
      });
      if (product) return { ean: normalized, product, suggestion: null };
      return {
        ean: normalized,
        product: null,
        suggestion: { title: external.title, brand: external.brand },
      };
    }
    return { ean: normalized, product: null, suggestion: null };
  }

  /** Camera photo identification → find-or-create the product (no manual data). */
  async createFromIdentification(
    input: FromPhotoInput,
    userId: string | null = null,
  ): Promise<EnsuredProductDto> {
    const name = [input.brand, input.product]
      .map((s) => s?.trim())
      .filter((s): s is string => Boolean(s && s.length > 0))
      .join(' ')
      .trim();
    if (name.length < 2) return { product: null, created: false };

    let categorySlug: string | null = null;
    if (input.category) {
      const norm = input.category.trim().toLowerCase();
      const cats = await this.prisma.category.findMany({ select: { slug: true, name: true } });
      categorySlug =
        cats.find((c) => c.slug === norm || c.name.toLowerCase() === norm)?.slug ?? null;
    }
    return this.ensureProduct({
      canonicalName: name,
      brand: input.brand ?? null,
      categorySlug,
      imageUrl: input.imageDataUrl ?? null,
      imageSource: 'photo',
      userId,
    });
  }

  /** Manual entry that isn't in the catalog → live web research → auto-create. */
  async researchAndCreate(query: string, userId: string | null = null): Promise<EnsuredProductDto> {
    return this.ensureProduct({ canonicalName: query, userId, research: true });
  }

  /**
   * Find-or-create a product from sparse external data (scan / photo / research).
   * Returns an existing strong match when one exists; otherwise creates it,
   * optionally enriched via live web research, and remembers the EAN.
   */
  private async ensureProduct(params: {
    canonicalName: string;
    brand?: string | null;
    categorySlug?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    /** Provider key of the image origin (for the cache attribution). */
    imageSource?: string;
    ean?: string | null;
    userId?: string | null;
    research?: boolean;
  }): Promise<EnsuredProductDto> {
    const rawName = params.canonicalName.trim();
    if (rawName.length < 2) return { product: null, created: false };

    let canonicalName = rawName;
    let brand = params.brand ?? null;
    let categorySlug = params.categorySlug ?? null;
    let description = params.description ?? null;

    if (params.research) {
      try {
        const slugs = await this.prisma.category.findMany({ select: { slug: true } });
        const researched = await this.ai.researchProduct(
          rawName,
          slugs.map((s) => s.slug),
        );
        if (researched.canonicalName) canonicalName = researched.canonicalName;
        brand = brand ?? researched.brand;
        categorySlug = categorySlug ?? researched.categorySlug;
        description = description ?? researched.description;
      } catch (err) {
        this.logger.warn(`Product research failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Strong duplicate? Return the existing product instead of creating a twin.
    const candidates = await this.matching.findDuplicateCandidates(canonicalName, 3);
    const strong = candidates.find((c) => c.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate);
    if (strong) {
      if (params.ean) await this.attachIdentifier(strong.product.id, params.ean);
      if (params.imageUrl && !strong.product.imageUrl) {
        const updated = await this.prisma.product.update({
          where: { id: strong.product.id },
          data: { imageUrl: params.imageUrl },
          include: PRODUCT_INCLUDE,
        });
        this.images.cacheInBackground(
          strong.product.id,
          params.imageUrl,
          params.imageSource ?? 'manual',
        );
        return { product: toProductSummaryDto(updated), created: false };
      }
      return { product: toProductSummaryDto(strong.product), created: false };
    }

    const result = await this.create(
      {
        canonicalName,
        brand: brand ?? undefined,
        categorySlug: categorySlug ?? undefined,
        description: description ?? undefined,
        imageUrl: params.imageUrl ?? undefined,
        forceCreate: true,
      },
      params.userId ?? null,
      params.imageSource,
    );
    if (!result.created || !result.product) return { product: null, created: false };
    if (params.ean) await this.attachIdentifier(result.product.id, params.ean);
    const product = await this.getSummaryOrThrow(result.product.id);
    return { product, created: true };
  }

  private async attachIdentifier(productId: string, ean: string): Promise<void> {
    try {
      await this.prisma.productIdentifier.upsert({
        where: { type_value: { type: 'EAN', value: ean } },
        create: { productId, type: 'EAN', value: ean, source: 'scan' },
        update: {},
      });
    } catch (err) {
      this.logger.warn(`Attach identifier failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * External EAN database chain, best source first: Open Icecat (official
   * manufacturer data + press-quality images, when configured) → Open Food
   * Facts → UPCitemdb trial.
   */
  private async lookupEanExternal(ean: string): Promise<EanLookupHit | null> {
    return (
      (await this.icecat.lookupGtin(ean)) ??
      (await this.lookupOpenFoodFacts(ean)) ??
      (await this.lookupUpcItemDb(ean))
    );
  }

  private async lookupOpenFoodFacts(ean: string): Promise<EanLookupHit | null> {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_name,brands,image_url,image_front_url`,
        {
          headers: { Accept: 'application/json', 'User-Agent': 'Wudly/1.0 (wudly.app)' },
          signal: AbortSignal.timeout(6_000),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        status?: number;
        product?: {
          product_name?: string;
          brands?: string;
          image_url?: string;
          image_front_url?: string;
        };
      };
      if (data.status !== 1 || !data.product) return null;
      const title = data.product.product_name?.trim();
      if (!title) return null;
      return {
        title,
        brand: data.product.brands?.split(',')[0]?.trim() || null,
        image: data.product.image_front_url?.trim() || data.product.image_url?.trim() || null,
        source: 'openfoodfacts',
      };
    } catch {
      return null;
    }
  }

  private async lookupUpcItemDb(ean: string): Promise<EanLookupHit | null> {
    try {
      const res = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(ean)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000) },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        items?: Array<{ title?: string; brand?: string; images?: string[] }>;
      };
      const item = data.items?.[0];
      const title = item?.title?.trim();
      if (!title) return null;
      return {
        title,
        brand: item?.brand?.trim() || null,
        image: item?.images?.find((u) => typeof u === 'string' && u.startsWith('http')) ?? null,
        source: 'upcitemdb',
      };
    } catch (err) {
      this.logger.warn(`EAN lookup failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Pre-purchase regret check. Uses Wudly's own catalog data when available
   * (the honest signal); otherwise asks the AI for a careful estimate; otherwise
   * returns a clear "no data yet" message. Never fabricates numbers.
   */
  async regretCheck(input: RegretCheckInput): Promise<RegretCheckDto> {
    const query = (input.query?.trim() || this.deriveQueryFromUrl(input.url ?? '')).trim();

    if (query.length >= 2) {
      const candidates = await this.matching.search(query, 1);
      const top = candidates[0]?.product;
      if (top) {
        const snap = await this.prisma.productInsightSnapshot.findUnique({
          where: { productId: top.id },
        });
        const rebuy = snap?.rebuyScore ?? null;
        if (rebuy !== null && (snap?.experienceCount ?? 0) > 0) {
          const concern = this.firstAspectLabel(snap?.topNegativeAspects);
          return {
            productId: top.id,
            productName: top.canonicalName,
            rebuyProbability: rebuy,
            topConcern: concern,
            summary: concern
              ? `${rebuy}% würden wieder kaufen — häufigster Vorbehalt: ${concern}.`
              : `${rebuy}% der Besitzer würden es wieder kaufen.`,
            source: 'catalog',
          };
        }
      }

      try {
        const est = await this.ai.assessRegret(query);
        if (est.summary && est.summary.trim().length > 0) {
          return {
            productId: null,
            productName: query,
            rebuyProbability: est.rebuyProbability,
            topConcern: est.topConcern,
            summary: est.summary,
            source: 'ai',
          };
        }
      } catch (err) {
        this.logger.warn(`Regret estimate failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      productId: null,
      productName: query.length >= 2 ? query : null,
      rebuyProbability: null,
      topConcern: null,
      summary:
        'Zu diesem Produkt gibt es noch keine echten Daten. Scanne es nach dem Kauf und teile, ob du es wieder kaufen würdest.',
      source: 'none',
    };
  }

  /** Record a swipe-deck quick vote (deduped per user) and return the live tally. */
  async vote(
    productId: string,
    userId: string | null,
    input: QuickVoteInput,
  ): Promise<QuickVoteResultDto> {
    await this.findOrThrow(productId);
    const tags = input.tags ?? [];
    if (userId) {
      await this.prisma.quickVote.upsert({
        where: { productId_userId: { productId, userId } },
        create: { productId, userId, value: input.value, tags },
        update: { value: input.value, tags },
      });
    } else {
      await this.prisma.quickVote.create({
        data: { productId, userId: null, value: input.value, tags },
      });
    }
    return this.quickVoteTally(productId);
  }

  /** Products related to this one (same category), most-reviewed first. */
  async listSimilar(id: string, take = 6): Promise<ProductSummaryDto[]> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, categoryId: true },
    });
    if (!product?.categoryId) return [];
    const rows = await this.prisma.product.findMany({
      where: { categoryId: product.categoryId, status: 'ACTIVE', NOT: { id } },
      include: PRODUCT_INCLUDE,
      orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }, { createdAt: 'desc' }],
      take: take * 2,
    });
    return rows
      .filter(
        (p) =>
          !isExcludedFromRankings({
            canonicalName: p.canonicalName,
            categorySlug: p.category?.slug ?? null,
          }),
      )
      .slice(0, take)
      .map(toProductSummaryDto);
  }

  /** The current user's products, split into owned vs. added (created). */
  async listMine(userId: string): Promise<{
    owned: ProductSummaryDto[];
    created: ProductSummaryDto[];
  }> {
    const [ownerships, created] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { userId },
        include: { product: { include: PRODUCT_INCLUDE } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.findMany({
        where: { createdByUserId: userId, status: { not: 'HIDDEN' } },
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const ownedProducts = ownerships
      .map((o) => o.product)
      .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.status !== 'HIDDEN');
    const ownedIds = new Set(ownedProducts.map((p) => p.id));

    return {
      owned: ownedProducts.map(toProductSummaryDto),
      created: created.filter((p) => !ownedIds.has(p.id)).map(toProductSummaryDto),
    };
  }

  /** Aggregate YES/NO quick votes for a product. */
  async quickVoteTally(productId: string): Promise<QuickVoteResultDto> {
    const [yes, no] = await Promise.all([
      this.prisma.quickVote.count({ where: { productId, value: 'YES' } }),
      this.prisma.quickVote.count({ where: { productId, value: 'NO' } }),
    ]);
    const total = yes + no;
    return { rebuy: total > 0 ? Math.round((yes / total) * 100) : null, count: total, yes, no };
  }

  /** Best-effort product name from a shop URL's last path segment. */
  private deriveQueryFromUrl(url: string): string {
    if (!url) return '';
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      const seg = u.pathname.split('/').filter(Boolean).pop() ?? '';
      return decodeURIComponent(seg)
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b(p|dp|product|produkt|artikel|item)\b/gi, ' ')
        .replace(/\b\d{4,}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return '';
    }
  }

  /** First label out of a persisted aspect JSON array (topNegativeAspects). */
  private firstAspectLabel(value: unknown): string | null {
    if (!Array.isArray(value)) return null;
    const first = value[0] as { label?: string } | undefined;
    return first?.label?.trim() || null;
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
  async create(
    input: CreateProductInput,
    createdByUserId: string | null = null,
    imageSource = 'manual',
  ): Promise<CreateProductResultDto> {
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
        createdByUserId,
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

    // Pull the external image into our own cache (uniform, permanent thumbnails).
    if (product.imageUrl) {
      this.images.cacheInBackground(product.id, product.imageUrl, imageSource);
    }

    // Create an (empty) snapshot so the product reads consistently from the start.
    const insights = await this.insights.regenerate(product.id);
    return { created: true, product: toProductDetailDto(product, insights, []) };
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
    // A newly-set external image gets pulled into our own cache.
    if (typeof data.imageUrl === 'string' && !data.imageUrl.startsWith('/')) {
      this.images.cacheInBackground(id, data.imageUrl, 'manual');
    }
    const [insights, externalRatings] = await Promise.all([
      this.insights.getInsights(id),
      this.externalRatings.listForProduct(id),
    ]);
    return toProductDetailDto(product, insights, externalRatings);
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

  private async maybeLogMergeCandidate(created: ProductWithRelations, name: string): Promise<void> {
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
