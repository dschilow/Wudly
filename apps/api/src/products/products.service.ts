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
  type ExternalProductSuggestionDto,
  type ProductFindResultDto,
  type ImagelessProductDto,
  type ImageBackfillReportDto,
  type ImageBackfillResultDto,
  type RatingBackfillReportDto,
  type RatingBackfillResultDto,
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

/** Market-search results barely change — cache generously to respect quotas. */
const SUGGESTION_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Raw UPCitemdb item shape (the fields we read). */
interface UpcItem {
  title?: string;
  brand?: string;
  ean?: string;
  upc?: string;
  model?: string;
  color?: string;
  size?: string;
  dimension?: string;
  weight?: string;
  description?: string;
  images?: string[];
}

/** Fold German umlauts to their ASCII digraphs — UPCitemdb indexes ASCII titles. */
function foldUmlauts(s: string): string {
  return s
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/**
 * Cheap spelling rewrites for the strict market search. Order matters — the
 * caller stops at the first variant with enough hits. Deduplicated, capped.
 *
 * UPCitemdb matches on raw ASCII spelling, so the same product appears under
 * spaced/glued model names ("magic 5 pro" vs "magic5 pro") and German umlauts
 * never match the (ASCII) titles in its index ("kärcher" → "karcher"/"kaercher").
 * The brand-only variant is a last resort: when the full query misses, the bare
 * first word ("kärcher") still surfaces the maker's lineup to pick from.
 */
function spellingVariants(q: string): string[] {
  const folded = foldUmlauts(q);
  // Plain umlaut-drop ("kärcher" → "karcher") matches catalogs that strip,
  // rather than expand, the umlaut — common for brand names.
  const stripped = q.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
  const out = [q, folded, stripped];
  // "magic 5 pro" → "magic5 pro" (glue a letter-word to a following number)
  out.push(folded.replace(/([a-z]) (\d)/gi, '$1$2'));
  // "magic5 pro" → "magic 5 pro" (split a number off a letter-word)
  out.push(folded.replace(/([a-z])(\d)/gi, '$1 $2'));
  // collapsed: drop all spaces ("honormagic5pro")
  out.push(folded.replace(/\s+/g, ''));
  // Brand-only last resort: the first word alone (≥3 chars), umlauts folded.
  const firstWord = folded.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3 && firstWord !== folded) out.push(firstWord);
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length >= 3))].slice(0, 6);
}

/**
 * Heuristic: is this market hit a third-party accessory rather than the product
 * itself? Catches the common UPCitemdb noise (cases, covers, cables, glass) so a
 * phone search doesn't surface "Case for Honor Magic5 Pro". Conservative — only
 * flags clear accessory wording, and "no-name" generic brands.
 */
function isAccessory(title: string, brand: string | undefined): boolean {
  const t = title.toLowerCase();
  const ACCESSORY = [
    'case for',
    'cover for',
    'hülle',
    'schutzhülle',
    'screen protector',
    'displayschutz',
    'panzerglas',
    'tempered glass',
    'wallet',
    'holster',
    'lanyard',
    'charger for',
    'cable for',
    'ladekabel für',
    'adapter for',
    'replacement',
    'stylus',
    'mount for',
    'stand for',
    'skin for',
    'sticker',
  ];
  if (ACCESSORY.some((kw) => t.includes(kw))) return true;
  // "Suitable for X", "compatible with X" → accessory marketing.
  if (/\b(suitable for|compatible with|kompatibel mit|geeignet für)\b/.test(t)) return true;
  // Generic no-name brands UPCitemdb assigns to unbranded accessories.
  const b = (brand ?? '').trim().toLowerCase();
  if (b === 'no' || b === 'generic' || b === 'unbranded' || b === 'oem') return true;
  return false;
}

/** Clean + cap a spec list: trim, drop blanks, dedupe labels, max 14. */
function normalizeSpecs(
  specs: Array<{ label: string; value: string }> | undefined,
): Array<{ label: string; value: string }> {
  if (!specs?.length) return [];
  const seen = new Set<string>();
  const out: Array<{ label: string; value: string }> = [];
  for (const s of specs) {
    const label = s.label?.trim();
    const value = s.value?.trim();
    if (!label || !value) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value });
    if (out.length >= 14) break;
  }
  return out;
}

/**
 * Build the image-search query: "<brand> <name>", but only prepend the brand
 * when the name doesn't already start with it — otherwise "Sony WH-1000XM6"
 * becomes "Sony Sony WH-1000XM6" and search results suffer.
 */
function buildImageQuery(brand: string | null | undefined, name: string): string {
  const n = name.trim();
  const b = brand?.trim();
  if (!b) return n;
  if (n.toLowerCase().startsWith(b.toLowerCase())) return n;
  return `${b} ${n}`;
}

/**
 * Merge two suggestion lists (market first, AI as filler) dropping duplicates.
 * Two entries are the "same" product when they share an EAN or their titles
 * normalize to the same token soup — so the AI doesn't re-list what UPCitemdb
 * already returned. Capped to keep the picker short.
 */
function mergeSuggestions(
  primary: ExternalProductSuggestionDto[],
  filler: ExternalProductSuggestionDto[],
  cap: number,
): ExternalProductSuggestionDto[] {
  const seenEans = new Set<string>();
  const seenTitles = new Set<string>();
  const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
  const out: ExternalProductSuggestionDto[] = [];

  for (const item of [...primary, ...filler]) {
    if (out.length >= cap) break;
    const ean = item.ean?.trim();
    if (ean && seenEans.has(ean)) continue;
    const norm = normTitle(item.title);
    if (norm && seenTitles.has(norm)) continue;
    if (ean) seenEans.add(ean);
    if (norm) seenTitles.add(norm);
    out.push(item);
  }
  return out;
}

/** Coerce a product's JSON `specs` column back into typed pairs. */
function asSpecArray(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is { label: string; value: string } =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>).label === 'string' &&
      typeof (v as Record<string, unknown>).value === 'string',
  );
}

/** Flatten UPCitemdb's loose attribute fields into label/value spec pairs. */
function upcItemSpecs(item: UpcItem | undefined): Array<{ label: string; value: string }> {
  if (!item) return [];
  const pairs: Array<[string, string | undefined]> = [
    ['Modell', item.model],
    ['Farbe', item.color],
    ['Größe', item.size],
    ['Maße', item.dimension],
    ['Gewicht', item.weight],
  ];
  return pairs
    .map(([label, value]) => ({ label, value: value?.trim() ?? '' }))
    .filter((p) => p.value.length > 0 && p.value.length <= 80);
}

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

  /**
   * Unified search used by the check screen — the server decides the cascade,
   * the client renders ONE consistent list:
   *
   *   1. catalog hits with a DISPLAY cutoff (the recall search is intentionally
   *      loose at 0.18 similarity, which surfaced "Bosch Eco…" for "Ecoflow" —
   *      here only genuinely relevant hits survive)
   *   2. `deep` only (the settled query, not every keystroke): market DBs with
   *      spelling variants + accessory filter — protects the daily quota
   *
   * `hasStrongMatch` is the single source of truth for "does the catalog already
   * have this?" — the client uses it to decide whether to go deep / ask the AI.
   */
  async findProducts(query: string, deep = false): Promise<ProductFindResultDto> {
    const candidates = await this.matching.search(query, 12);

    // Display cutoff: relevant-only. 0.45 keeps typo matches ("roborok") but
    // drops prefix noise ("eco…" for "ecoflow" scores ≈ 0.25).
    const relevant = candidates.filter((c) => c.similarity >= 0.45).slice(0, 8);
    const hasStrongMatch = candidates.some((c) => c.similarity >= 0.8);

    const market =
      deep && !hasStrongMatch && query.trim().length >= 3
        ? await this.marketAndAiSuggestions(query)
        : [];

    return {
      catalog: relevant.map((c) => toProductSummaryDto(c.product)),
      market,
      hasStrongMatch,
    };
  }

  /**
   * The deep "noch nicht auf Wudly" list: real-market hits (UPCitemdb, EAN-rich
   * → Icecat-quality path) COMPLEMENTED by AI candidates. Previously a single
   * weak market hit (e.g. one surviving accessory) blocked the AI step entirely,
   * so German queries UPCitemdb indexes poorly returned almost nothing. Now the
   * AI always runs when the market list is thin (< 3), and both feed one merged,
   * deduplicated list — market first (it carries EANs), AI as filler.
   */
  private async marketAndAiSuggestions(query: string): Promise<ExternalProductSuggestionDto[]> {
    const market = await this.externalSuggestions(query);
    const merged =
      market.length >= 3 ? market : mergeSuggestions(market, await this.aiCandidates(query), 6);
    return this.fillSuggestionImages(merged);
  }

  /**
   * Give image-less suggestions a thumbnail (hotlink, not cached — there's no
   * product row yet). UPCitemdb often omits images and AI candidates never carry
   * one, so the picker would otherwise show a text-only row. Best-effort and
   * parallel; the image search is memo-cached so repeats are free.
   */
  private async fillSuggestionImages(
    suggestions: ExternalProductSuggestionDto[],
  ): Promise<ExternalProductSuggestionDto[]> {
    return Promise.all(
      suggestions.map(async (s) => {
        if (s.image) return s;
        const image = await this.images.previewImageUrl(buildImageQuery(s.brand, s.title));
        return image ? { ...s, image } : s;
      }),
    );
  }

  /**
   * AI product candidates for a query nothing else could resolve — the model
   * names up to 3 real products (web-verified) the user most likely means.
   * Presented in the SAME list style as market hits; the user never sees which
   * path resolved their search. Cached like the market search.
   */
  async aiCandidates(query: string): Promise<ExternalProductSuggestionDto[]> {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (q.length < 3) return [];

    const cached = this.aiCandidateCache.get(q);
    if (cached && Date.now() - cached.at < SUGGESTION_CACHE_TTL_MS) return cached.items;

    let items: ExternalProductSuggestionDto[] = [];
    try {
      const candidates = await this.ai.suggestProducts(query.trim());
      items = candidates.map((c) => ({
        title: c.name,
        brand: c.brand,
        ean: c.ean,
        image: null,
        source: 'ai',
      }));
    } catch (err) {
      this.logger.warn(`AI candidates failed: ${err instanceof Error ? err.message : err}`);
    }

    if (this.aiCandidateCache.size > 300) this.aiCandidateCache.clear();
    this.aiCandidateCache.set(q, { at: Date.now(), items });
    return items;
  }

  private readonly aiCandidateCache = new Map<
    string,
    { at: number; items: ExternalProductSuggestionDto[] }
  >();

  async getDetail(id: string): Promise<ProductDetailDto> {
    const product = await this.findOrThrow(id);
    const [insights, externalRatings] = await Promise.all([
      this.insights.getInsights(id),
      this.externalRatings.listForProduct(id),
    ]);

    // No cached photo yet → trigger a background hunt so the next page load has it.
    // Check via a lightweight count instead of loading the image bytes.
    void this.prisma.productImage.findUnique({ where: { productId: id }, select: { productId: true } })
      .then((img) => { if (!img) void this.rehuntImage(id).catch(() => undefined); })
      .catch(() => undefined);

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
        description: external.description ?? null,
        specs: external.specs,
        imageUrl: external.image,
        imageSource: external.source,
        ean: normalized,
        userId,
        // No image/specs from the EAN DB? Let AI fill the gaps (last resort).
        research: !external.image || !external.specs?.length,
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
      // Camera photo is only for AI recognition — never store it as product
      // image. Research fills description/specs and hunts an official photo.
      userId,
      research: true,
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
    specs?: Array<{ label: string; value: string }>;
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
    let specs = normalizeSpecs(params.specs);
    // A photo from an EAN database is trustworthy and can be set directly; AI
    // hints (direct image url / product page) are only LEADS for the validated
    // background hunt — never stored unverified.
    const dbImageUrl = params.imageUrl ?? null;
    const dbImageSource = params.imageSource ?? 'manual';
    let aiImageUrl: string | null = null;
    let aiPageUrl: string | null = null;

    // Enrichment cascade — only ask the AI to fill what the catalogs couldn't
    // (description, an image, a couple of specs). DB facts always win.
    if (params.research) {
      try {
        const slugs = await this.prisma.category.findMany({ select: { slug: true } });
        const researched = await this.ai.researchProduct(
          rawName,
          slugs.map((s) => s.slug),
        );
        if (researched.found) {
          if (researched.canonicalName && !params.imageUrl) {
            canonicalName = researched.canonicalName;
          }
          brand = brand ?? researched.brand;
          categorySlug = categorySlug ?? researched.categorySlug;
          description = description ?? researched.description;
          if (specs.length === 0 && researched.specs?.length) {
            specs = normalizeSpecs(researched.specs);
          }
          aiImageUrl = researched.imageUrl?.trim() || null;
          aiPageUrl = researched.productUrl?.trim() || null;
        }
      } catch (err) {
        this.logger.warn(`Product research failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    const imageQuery = buildImageQuery(brand, canonicalName);
    const huntImage = (productId: string) =>
      this.images.findAndCacheInBackground(productId, imageQuery, {
        candidateUrls: [aiImageUrl],
        pageUrl: aiPageUrl,
      });

    // Strong duplicate? Return the existing product, topping up missing data.
    const candidates = await this.matching.findDuplicateCandidates(canonicalName, 3);
    const strong = candidates.find((c) => c.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate);
    if (strong) {
      if (params.ean) await this.attachIdentifier(strong.product.id, params.ean);
      const data: Record<string, unknown> = {};
      if (dbImageUrl && !strong.product.imageUrl) data.imageUrl = dbImageUrl;
      if (description && !strong.product.description) data.description = description;
      if (specs.length > 0 && asSpecArray(strong.product.specs).length === 0) data.specs = specs;

      // Backfill: an existing product without any photo gets the image hunt.
      if (!strong.product.imageUrl && !dbImageUrl) huntImage(strong.product.id);

      if (Object.keys(data).length > 0) {
        const updated = await this.prisma.product.update({
          where: { id: strong.product.id },
          data,
          include: PRODUCT_INCLUDE,
        });
        if (data.imageUrl) {
          this.images.cacheInBackground(strong.product.id, dbImageUrl!, dbImageSource);
        }
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
        imageUrl: dbImageUrl ?? undefined,
        forceCreate: true,
      },
      params.userId ?? null,
      dbImageSource,
    );
    if (!result.created || !result.product) return { product: null, created: false };
    if (params.ean) await this.attachIdentifier(result.product.id, params.ean);
    if (specs.length > 0) {
      await this.prisma.product.update({
        where: { id: result.product.id },
        data: { specs },
      });
    }
    // No trustworthy DB photo? Hunt one in the background (validated first).
    if (!dbImageUrl) huntImage(result.product.id);
    // Fire-and-forget: research external rating FACTS (Amazon/Idealo/…) so the
    // fresh product page shows "Bewertungen anderswo" without admin work.
    this.researchRatingsInBackground(result.product.id, canonicalName, brand);
    const product = await this.getSummaryOrThrow(result.product.id);
    return { product, created: true };
  }

  /**
   * Re-run the product-photo hunt for one product and return the diagnostic
   * report (which stage found what, and why candidates failed). Used by the
   * admin debug endpoint to answer "why no image?" without redeploying, and to
   * heal existing imageless products on demand. Re-asks the AI for fresh leads
   * (a product page url + direct image url) when research is available.
   */
  async rehuntImage(productId: string): Promise<{
    productId: string;
    name: string;
    imageQuery: string;
    aiImageUrl: string | null;
    aiPageUrl: string | null;
    report: Awaited<ReturnType<ProductImageService['hunt']>>;
  }> {
    const product = await this.findOrThrow(productId);
    let aiImageUrl: string | null = null;
    let aiPageUrl: string | null = null;
    try {
      const slugs = await this.prisma.category.findMany({ select: { slug: true } });
      const researched = await this.ai.researchProduct(
        product.canonicalName,
        slugs.map((s) => s.slug),
      );
      if (researched.found) {
        aiImageUrl = researched.imageUrl?.trim() || null;
        aiPageUrl = researched.productUrl?.trim() || null;
      }
    } catch (err) {
      this.logger.warn(`Rehunt research failed: ${err instanceof Error ? err.message : err}`);
    }
    const imageQuery = buildImageQuery(product.brand, product.canonicalName);
    const report = await this.images.hunt(productId, imageQuery, {
      candidateUrls: [aiImageUrl],
      pageUrl: aiPageUrl,
    });
    return { productId, name: product.canonicalName, imageQuery, aiImageUrl, aiPageUrl, report };
  }

  /**
   * Admin "fehlt warum" overview: products with no cached photo yet. A product is
   * imageless when it has no `ProductImage` row — `imageUrl` alone is unreliable
   * (it may point at a generated SVG or a stale external url). Oldest first, so
   * long-standing gaps surface before fresh additions that are still hunting.
   */
  async listImagelessProducts(limit = 50): Promise<ImagelessProductDto[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: { not: 'HIDDEN' }, cachedImage: null },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((p) => ({
      id: p.id,
      canonicalName: p.canonicalName,
      brand: p.brand,
      categoryName: p.category?.name ?? null,
      createdAt: p.createdAt.toISOString(),
      // A stored imageUrl that isn't our cached-photo path is a stale/external
      // lead a prior hunt left behind — worth flagging since it can render broken.
      hasStaleImageUrl: Boolean(p.imageUrl) && !p.imageUrl!.includes('/photo'),
    }));
  }

  /**
   * Backfill photos for products that never got one. Re-hunts the oldest imageless
   * products SEQUENTIALLY (the Google CSE quota is per-day and shared — parallel
   * hunts would burn it and trip rate limits), caching the first real image found
   * for each. Returns a per-product report plus how many gaps remain, so the admin
   * can run it again until the catalog is fully covered.
   */
  async backfillMissingImages(limit = 10): Promise<ImageBackfillReportDto> {
    const batchSize = Math.min(Math.max(limit, 1), 30);
    const products = await this.prisma.product.findMany({
      where: { status: { not: 'HIDDEN' }, cachedImage: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    const results: ImageBackfillResultDto[] = [];
    let cseConfigured = false;
    for (const { id } of products) {
      try {
        const { name, report } = await this.rehuntImage(id);
        cseConfigured = report.cseConfigured;
        results.push({
          productId: id,
          name,
          storedVia: report.storedVia,
          found: Boolean(report.storedVia),
          reason: report.storedVia
            ? null
            : !report.cseConfigured && report.aiCount === 0 && !report.ogFound
              ? 'cse-off'
              : report.tried.length === 0
                ? 'no-candidates'
                : 'all-candidates-failed',
        });
      } catch (err) {
        this.logger.warn(
          `Backfill hunt failed for ${id}: ${err instanceof Error ? err.message : err}`,
        );
        results.push({ productId: id, name: id, storedVia: null, found: false, reason: 'error' });
      }
    }

    const remaining = await this.prisma.product.count({
      where: { status: { not: 'HIDDEN' }, cachedImage: null },
    });
    return {
      attempted: results.length,
      found: results.filter((r) => r.found).length,
      cseConfigured,
      remaining,
      results,
    };
  }

  /**
   * Background enrichment: aggregated rating facts from other platforms via AI
   * web research (average + count + product link — never review texts, per the
   * transparency rules). No-op with the dummy provider; failures are silent.
   */
  private researchRatingsInBackground(
    productId: string,
    name: string,
    brand: string | null,
  ): void {
    void this.researchAndStoreRatings(productId, name, brand).catch((err) => {
      this.logger.warn(
        `Ratings research failed for ${productId}: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  /**
   * Awaitable core of the rating research: ask the AI for aggregated rating FACTS
   * (average + count + link — never review texts) and upsert them. Returns how many
   * were stored. Shared by the create-time background enrichment and the admin
   * backfill. No-op (returns 0) with the dummy/local provider, which can't web-search.
   */
  private async researchAndStoreRatings(
    productId: string,
    name: string,
    brand: string | null,
  ): Promise<number> {
    const ratings = await this.ai.researchExternalRatings(name, brand);
    let stored = 0;
    for (const rating of ratings) {
      if (rating.url.length > 500) continue;
      await this.externalRatings.upsert(productId, {
        source: rating.source,
        sourceLabel: rating.sourceLabel,
        url: rating.url,
        kind: rating.kind,
        value: rating.value,
        maxValue: rating.maxValue,
        count: rating.count,
        note: null,
      });
      stored += 1;
    }
    if (stored > 0) {
      this.logger.log(`External ratings researched for ${productId}: ${stored}`);
    }
    return stored;
  }

  /**
   * Admin backfill: research external ratings for existing products that have none
   * yet. Runs SEQUENTIALLY (the AI web search is rate-limited and shared), oldest
   * first, in small batches — run repeatedly until `remaining` reaches 0. Mirrors
   * the image backfill. Returns a per-product report.
   */
  async backfillMissingRatings(limit = 8): Promise<RatingBackfillReportDto> {
    const batchSize = Math.min(Math.max(limit, 1), 25);
    const products = await this.prisma.product.findMany({
      where: { status: { not: 'HIDDEN' }, externalRatings: { none: {} } },
      select: { id: true, canonicalName: true, brand: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    const results: RatingBackfillResultDto[] = [];
    for (const p of products) {
      try {
        const stored = await this.researchAndStoreRatings(p.id, p.canonicalName, p.brand);
        results.push({ productId: p.id, name: p.canonicalName, found: stored, error: null });
      } catch (err) {
        this.logger.warn(
          `Rating backfill failed for ${p.id}: ${err instanceof Error ? err.message : err}`,
        );
        results.push({
          productId: p.id,
          name: p.canonicalName,
          found: 0,
          error: err instanceof Error ? err.message : 'error',
        });
      }
    }

    const remaining = await this.prisma.product.count({
      where: { status: { not: 'HIDDEN' }, externalRatings: { none: {} } },
    });
    return {
      attempted: results.length,
      withRatings: results.filter((r) => r.found > 0).length,
      totalFound: results.reduce((sum, r) => sum + r.found, 0),
      remaining,
      results,
    };
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

  /**
   * Free-text search against the real product market — NO AI involved. Used
   * when the local catalog has no hits: UPCitemdb's trial search returns real
   * products with EANs; selecting one goes through `resolveEan`, where Icecat
   * (official manufacturer titles + images) enriches the created product.
   *
   * The trial tier allows ~100 requests/day, so results are memo-cached and
   * the endpoint is rate-limited. Failures degrade to an empty list.
   */
  async externalSuggestions(query: string): Promise<ExternalProductSuggestionDto[]> {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (q.length < 3) return [];

    const cached = this.suggestionCache.get(q);
    if (cached && Date.now() - cached.at < SUGGESTION_CACHE_TTL_MS) return cached.items;

    // UPCitemdb matches strictly on spelling, so "magic 5 pro" and "magic5 pro"
    // return different sets. Try the query, then a few cheap rewrites until one
    // yields enough hits — capped so a true miss can't burn the daily quota.
    let items: ExternalProductSuggestionDto[] = [];
    for (const variant of spellingVariants(q)) {
      items = await this.fetchSuggestions(variant);
      if (items.length >= 2) break;
    }

    // Cache even empty results — repeating a miss would burn the daily quota.
    if (this.suggestionCache.size > 300) this.suggestionCache.clear();
    this.suggestionCache.set(q, { at: Date.now(), items });
    return items;
  }

  /** One UPCitemdb free-text search → cleaned suggestions (empty on failure). */
  private async fetchSuggestions(q: string): Promise<ExternalProductSuggestionDto[]> {
    try {
      const res = await fetch(
        `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(q)}&type=product&match_mode=0`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { items?: UpcItem[] };
      return this.cleanSuggestions(data.items ?? []);
    } catch (err) {
      this.logger.warn(`External search failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /** Dedupe + de-noise raw market hits: real new products first, refurbished as
      filler; accessories (cases/cables/…), twins and EAN-less rows dropped. */
  private cleanSuggestions(raw: UpcItem[]): ExternalProductSuggestionDto[] {
    const seenTitles = new Set<string>();
    const seenEans = new Set<string>();
    const clean: ExternalProductSuggestionDto[] = [];
    const secondHand: ExternalProductSuggestionDto[] = [];

    for (const item of raw) {
      const title = item.title?.trim();
      const ean = item.ean?.trim() || item.upc?.trim();
      if (!title || !ean || seenEans.has(ean)) continue;
      // Drop third-party accessories — a phone search shouldn't list cases.
      if (isAccessory(title, item.brand)) continue;
      const norm = title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
      if (seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      seenEans.add(ean);

      const suggestion: ExternalProductSuggestionDto = {
        title,
        brand: item.brand?.trim() || null,
        ean,
        image: item.images?.find((u) => typeof u === 'string' && u.startsWith('https://')) ?? null,
        source: 'upcitemdb',
      };
      if (/\b(refurbished|renewed|restored|used|gebraucht)\b/i.test(title)) {
        secondHand.push(suggestion);
      } else {
        clean.push(suggestion);
      }
    }
    return [...clean, ...secondHand].slice(0, 6);
  }

  private readonly suggestionCache = new Map<
    string,
    { at: number; items: ExternalProductSuggestionDto[] }
  >();

  private async lookupUpcItemDb(ean: string): Promise<EanLookupHit | null> {
    try {
      const res = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(ean)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000) },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { items?: UpcItem[] };
      const item = data.items?.[0];
      const title = item?.title?.trim();
      if (!title) return null;
      return {
        title,
        brand: item?.brand?.trim() || null,
        image: item?.images?.find((u) => typeof u === 'string' && u.startsWith('http')) ?? null,
        description: item?.description?.trim() || null,
        specs: upcItemSpecs(item),
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

  /**
   * "Frisch im Katalog": recently added products, surfaced so newcomers with an
   * empty Wudly Signal still have something to show — their "Netz-Konsens" from
   * external ratings bridges the cold start. Products that already carry external
   * ratings are floated to the front, since the summary is the whole point here.
   */
  async listNewest(take = 8): Promise<ProductSummaryDto[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      // Over-fetch so the moderation filter + "has external ratings" sort still
      // leave a full row of results.
      take: take * 4,
    });
    return rows
      .filter(
        (p) =>
          !isExcludedFromRankings({
            canonicalName: p.canonicalName,
            categorySlug: p.category?.slug ?? null,
          }),
      )
      .sort((a, b) => {
        // Products with a Netz-Konsens first; within each group keep recency.
        const aHas = (a.insightSnapshot?.externalSourceCount ?? 0) > 0 ? 1 : 0;
        const bHas = (b.insightSnapshot?.externalSourceCount ?? 0) > 0 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
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
