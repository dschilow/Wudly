import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProductIdentifierType, ProductSighting } from '@prisma/client';
import {
  DEFAULT_SIMILARITY_THRESHOLDS,
  normalizeProductName,
  normalizeProductNameLoose,
  type ProductSightingInput,
  type SightingResolveQuery,
  type SightingResolutionDto,
  type SightingStatsDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductMatchingService } from '../products/product-matching.service';
import { ProductVariantsService } from '../products/product-variants.service';
import { ProductsService } from '../products/products.service';
import { ExternalRatingsService } from '../products/external-ratings.service';
import {
  toProductSummaryDto,
  type ProductWithRelations,
} from '../products/product.mapper';
import type { AppConfig } from '../config/configuration';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

/** Identifier types that dedupe globally (one physical product = one row). */
const STRONG_IDENTIFIERS = new Set<ProductIdentifierType>(['EAN', 'GTIN', 'ASIN']);

/**
 * Bundle/quantity spam that must never become a catalog product ("3er Pack …",
 * "2x …"). Single products in such listings resurface via other shops/titles.
 */
const BUNDLE_PATTERN = /(^\d+\s*x\s)|\b\d+\s*(stück|stk|er[- ]?pack|er[- ]?set)\b/i;

/** A shop rating below this many reviews is noise, not a fact worth showing. */
const MIN_SHOP_RATING_COUNT = 5;

/** Pretty labels for known shops; unknown domains fall back to the SLD. */
const SHOP_LABELS: Record<string, string> = {
  'mediamarkt.de': 'MediaMarkt',
  'saturn.de': 'Saturn',
  'amazon.de': 'Amazon',
  'otto.de': 'OTTO',
  'kaufland.de': 'Kaufland',
  'cyberport.de': 'Cyberport',
  'alternate.de': 'Alternate',
  'galaxus.de': 'Galaxus',
};

/**
 * Ingestion + resolution for browser-extension product sightings.
 *
 * The POST path is intentionally cheap and DB-only (identifier lookup, then
 * name matching) — everything that costs external quota or AI money happens
 * later in {@link SightingsWorkerService}'s staged pipeline. Sightings carry no
 * user or install identifiers: the table records demand, not people.
 */
@Injectable()
export class SightingsService {
  private readonly logger = new Logger(SightingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductsService) private readonly products: ProductsService,
    @Inject(ProductMatchingService) private readonly matching: ProductMatchingService,
    @Inject(ProductVariantsService) private readonly variants: ProductVariantsService,
    @Inject(ExternalRatingsService) private readonly externalRatings: ExternalRatingsService,
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Record a sighting and resolve it against the catalog in one round trip.
   * With EXTENSION_SIGHTINGS_ENABLED=false (kill switch) this degrades to a
   * pure lookup — the signal keeps working, ingestion stops.
   */
  async resolveAndRecord(input: ProductSightingInput): Promise<SightingResolutionDto> {
    if (!this.qualityGate(input)) return this.emptyResolution('rejected');
    if (!this.ingestEnabled) return this.resolveOnly(this.toResolveQuery(input));

    const matched = await this.resolveProduct({
      type: input.identifierType ?? null,
      value: input.identifierValue ?? null,
      title: input.title,
      brand: input.brand ?? null,
      domain: input.domain,
    });
    const row = await this.upsertSighting(input, matched?.id ?? null);

    // Second resolution path, and the one that matters after the pipeline ran:
    // the sighting row itself REMEMBERS which product it became. Fresh matching
    // cannot rediscover that link — the worker's AI cleans the spammy shop
    // title into a canonical name ("TCL 75C7K"), and the raw title never gets
    // near the 0.85 duplicate threshold again. Without this fallback the
    // overlay would keep telling the user "wird gerade aufgenommen" forever,
    // long after the product went live in the catalog.
    //
    // Third path: an EARLIER sighting of the same shop page already became a
    // product, but under a different row (see adoptLinkFromPageHistory).
    const product =
      matched ??
      (await this.loadProduct(row.productId)) ??
      (await this.adoptLinkFromPageHistory(input.productUrl ?? null, row));

    if (product) {
      // The page may show one CONFIGURATION of the family (65", 256 GB, a
      // color). Record it as a variant — never as a separate product. Shop
      // identifiers then attach variant-scoped, so the catalog knows which
      // EAN/SKU belongs to which configuration.
      const variant = await this.variants.ensureVariantFromTitle(product.id, input.title);
      // Remember the shop identifier on the product so every future sighting
      // resolves via the O(1) identifier path instead of name matching. Doing
      // this on the row-linked path too is what turns the fallback above into
      // a one-time repair: the next view resolves directly.
      if (input.identifierType && input.identifierValue) {
        await this.attachIdentifier(
          product.id,
          input.identifierType,
          input.identifierValue,
          input.domain,
          variant?.id ?? null,
        );
      }
      // Apply the shop rating right away — free, attributed Netz-Konsens.
      await this.applyShopRating(product.id, row);
    }

    if (!product) return this.emptyResolution('queued', input.title);
    if (product.status === 'HIDDEN') return this.emptyResolution('rejected');
    return this.knownResolution(product);
  }

  /** Pure lookup that records nothing — for users who disabled reporting. */
  async resolveOnly(query: SightingResolveQuery): Promise<SightingResolutionDto> {
    const resolved = await this.resolveProduct({
      type: query.type ?? null,
      value: query.value ?? null,
      title: query.q ?? '',
      domain: query.domain ?? null,
    });
    if (!resolved || resolved.status === 'HIDDEN') {
      return this.emptyResolution('queued', query.q ?? null);
    }
    return this.knownResolution(resolved);
  }

  /**
   * No catalog product (yet). The card must not be a dead end: it carries the
   * prefilled Wudly check so the user can look it up — or add it — right now.
   */
  private emptyResolution(
    status: 'queued' | 'rejected',
    searchTitle: string | null = null,
  ): SightingResolutionDto {
    return {
      status,
      product: null,
      webUrl: null,
      topRegretReason: null,
      topAlternative: null,
      ownUrl: null,
      searchUrl:
        status === 'queued' && searchTitle
          ? `${this.webBase()}/check?q=${encodeURIComponent(searchTitle.slice(0, 120))}`
          : null,
    };
  }

  /**
   * Recover the catalog product from an EARLIER sighting of the same shop page.
   *
   * A page's identity in this table is its `dedupeKey`, and that key can change
   * for the same shelf item: a marketing title rewrite changes a name-keyed
   * row, and a shop page that used to be reported by article number reports its
   * GTIN once the adapter learns to read it — a different key, so a different
   * row, with no link to the product the pipeline already built. The shop URL
   * does not move. Using it here means such a change costs nothing: no
   * re-queued product, no second (paid) research run for something the catalog
   * already has.
   *
   * The link is copied onto the current row, so this repair runs once.
   */
  private async adoptLinkFromPageHistory(
    productUrl: string | null,
    row: ProductSighting,
  ): Promise<ProductWithRelations | null> {
    if (!productUrl) return null;
    const previous = await this.prisma.productSighting.findFirst({
      where: { productUrl, productId: { not: null }, NOT: { id: row.id } },
      orderBy: { lastSeenAt: 'desc' },
      select: { productId: true },
    });
    const product = await this.loadProduct(previous?.productId ?? null);
    if (!product) return null;
    await this.prisma.productSighting.update({
      where: { id: row.id },
      data: { productId: product.id, status: 'MATCHED' },
    });
    this.logger.log(`Sighting ${row.dedupeKey} adopted product ${product.id} via page URL.`);
    return product;
  }

  /** The product a sighting row already resolved to in an earlier pipeline run. */
  private loadProduct(productId: string | null): Promise<ProductWithRelations | null> {
    if (!productId) return Promise.resolve(null);
    return this.prisma.product.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
  }

  /**
   * Full resolution for a catalog product, including the two lines that matter
   * most at the point of sale: the top regret reason and the most-named
   * "would rather have bought" alternative — straight from the cached insight
   * snapshot, no extra query or AI spend.
   */
  private knownResolution(product: ProductWithRelations): SightingResolutionDto {
    const snap = product.insightSnapshot;
    const topNegative = firstAspectLabel(snap?.topNegativeAspects);
    const topAlternative = firstString(snap?.insteadOfHighlights);
    return {
      status: 'known',
      product: toProductSummaryDto(product),
      webUrl: this.webUrl(product),
      topRegretReason: topNegative,
      topAlternative,
      ownUrl: `${this.webBase()}/products/${product.id}/own`,
      searchUrl: null,
    };
  }

  /** Admin observability: pipeline counters + the most-demanded open sightings. */
  async stats(): Promise<SightingStatsDto> {
    const [total, groups, topPending] = await Promise.all([
      this.prisma.productSighting.count(),
      this.prisma.productSighting.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.productSighting.findMany({
        where: { status: 'PENDING' },
        orderBy: [{ engageCount: 'desc' }, { seenCount: 'desc' }, { lastSeenAt: 'desc' }],
        take: 20,
      }),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
      topPending: topPending.map((s) => ({
        dedupeKey: s.dedupeKey,
        title: s.title,
        domain: s.domain,
        seenCount: s.seenCount,
        engageCount: s.engageCount,
        lastSeenAt: s.lastSeenAt.toISOString(),
      })),
    };
  }

  /**
   * Stable identity of a sighting across page views. Strong identifiers dedupe
   * globally; name-only sightings dedupe per shop (title conventions differ per
   * shop — cross-shop duplicates converge later via the create-path matcher).
   */
  dedupeKey(input: Pick<ProductSightingInput, 'identifierType' | 'identifierValue' | 'title' | 'domain'>): string {
    const type = input.identifierType;
    const value = input.identifierValue?.trim();
    if (type && value && STRONG_IDENTIFIERS.has(type)) {
      // EAN and GTIN share one keyspace — a GTIN-13 IS an EAN.
      const ns = type === 'ASIN' ? 'asin' : 'ean';
      return `${ns}:${ns === 'asin' ? value.toUpperCase() : value}`;
    }
    // Shop article numbers are stable identity; shop TITLES are not (marketing
    // rewrites them). Keying those sightings by title would fork a new PENDING
    // row on every rewrite — re-queuing a product the pipeline already built
    // and re-spending research budget on it.
    if (type && value) {
      return `${type.toLowerCase()}:${shopSource(input.domain).source}:${value.toUpperCase()}`;
    }
    return `name:${normalizeProductNameLoose(input.title).slice(0, 120)}@${input.domain.toLowerCase()}`;
  }

  /**
   * Junk that must not enter the queue at all. Deliberately conservative: a
   * false reject only delays a product until someone adds it another way.
   */
  qualityGate(input: Pick<ProductSightingInput, 'title' | 'productUrl'>): boolean {
    const loose = normalizeProductNameLoose(input.title);
    if (loose.length < 4) return false;
    if (BUNDLE_PATTERN.test(input.title)) return false;
    // SPA-race hybrids: on shops that navigate client-side, the extension can
    // briefly see the NEW page's URL/identifier with the OLD page's title
    // still in the DOM. Accepting such a mix would name-match the old product
    // and permanently attach the new shop identifier to it (attachIdentifier)
    // — every future lookup of the new product would then show the old one.
    if (!titleMatchesProductUrl(input.title, input.productUrl)) return false;
    return true;
  }

  /** DB-only resolution: identifier first (exact), then strong name match —
   *  raw shop title first, then the cleaned core (shop titles carry keyword
   *  spam that drags the similarity below the duplicate threshold). */
  private async resolveProduct(params: {
    type: ProductIdentifierType | null;
    value: string | null;
    title: string;
    brand?: string | null;
    domain: string | null;
  }): Promise<ProductWithRelations | null> {
    const { type, value, title, brand = null, domain } = params;
    const stored = type && value ? storedIdentifierValue(type, value, domain) : null;
    if (type && stored) {
      const types: ProductIdentifierType[] =
        type === 'EAN' || type === 'GTIN' ? ['EAN', 'GTIN'] : [type];
      const identifier = await this.prisma.productIdentifier.findFirst({
        where: { type: { in: types }, value: stored },
        include: { product: { include: PRODUCT_INCLUDE } },
      });
      if (identifier?.product) return identifier.product;
    }
    if (title.trim().length < 4) return null;
    for (const query of [...new Set([title, researchQuery(title, brand)])]) {
      const candidates = await this.matching.findDuplicateCandidates(query, 3);
      const strong = candidates.find(
        (c) => c.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate,
      );
      if (strong) return strong.product;
    }
    // No same-name product — but the page may show another CONFIGURATION of a
    // known family ("75 Zoll" while the catalog has the 65" model). Resolving
    // to the family keeps the overlay signal alive and stops the pipeline from
    // creating one catalog product per size/color/storage.
    const family = await this.variants.findFamilyProduct(title, brand);
    return family?.product ?? null;
  }

  private async upsertSighting(
    input: ProductSightingInput,
    productId: string | null,
  ): Promise<ProductSighting> {
    const key = this.dedupeKey(input);
    const engage = input.event === 'engage';
    const row = await this.prisma.productSighting.upsert({
      where: { dedupeKey: key },
      create: {
        dedupeKey: key,
        identifierType: input.identifierType ?? null,
        identifierValue: input.identifierValue ?? null,
        title: input.title.slice(0, 300),
        brand: input.brand ?? null,
        imageUrl: input.imageUrl ?? null,
        productUrl: input.productUrl ?? null,
        domain: input.domain.toLowerCase(),
        seenCount: 1,
        engageCount: engage ? 1 : 0,
        ratingValue: input.rating?.value ?? null,
        ratingMax: input.rating?.maxValue ?? null,
        ratingCount: input.rating?.count ?? null,
        status: productId ? 'MATCHED' : 'PENDING',
        productId,
      },
      update: {
        seenCount: { increment: engage ? 0 : 1 },
        engageCount: { increment: engage ? 1 : 0 },
        lastSeenAt: new Date(),
        // Shop ratings evolve — refresh the facts whenever the page has them.
        ...(input.rating
          ? {
              ratingValue: input.rating.value,
              ratingMax: input.rating.maxValue,
              ratingCount: input.rating.count ?? null,
            }
          : {}),
      },
    });
    // A late match upgrades the row; never downgrade an advanced status.
    if (productId && row.status === 'PENDING') {
      return this.prisma.productSighting.update({
        where: { id: row.id },
        data: { status: 'MATCHED', productId },
      });
    }
    return row;
  }

  /**
   * Apply a sighting's shop rating to a catalog product as an attributed
   * "Bewertungen anderswo" FACT (average + count + link — never review
   * texts). Idempotent per (product, shop) via the ExternalRating upsert;
   * repeat sightings simply refresh the value. Skips silently when the data
   * is too thin to be a fact: no rating, fewer than
   * {@link MIN_SHOP_RATING_COUNT} reviews, or no product URL to attribute.
   * Also used by the worker when the pipeline creates the product later.
   */
  async applyShopRating(
    productId: string,
    row: Pick<ProductSighting, 'ratingValue' | 'ratingMax' | 'ratingCount' | 'productUrl' | 'domain'>,
  ): Promise<void> {
    if (row.ratingValue === null || row.ratingMax === null || !row.productUrl) return;
    if ((row.ratingCount ?? 0) < MIN_SHOP_RATING_COUNT) return;
    const { source, label } = shopSource(row.domain);
    try {
      await this.externalRatings.upsert(productId, {
        source,
        sourceLabel: label,
        url: row.productUrl,
        kind: 'STARS',
        value: row.ratingValue,
        maxValue: row.ratingMax,
        count: row.ratingCount,
      });
    } catch (err) {
      this.logger.warn(`Shop rating upsert failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Type-aware identifier upsert (the products-service helper is EAN-only). */
  private async attachIdentifier(
    productId: string,
    type: ProductIdentifierType,
    value: string,
    domain: string | null,
    variantId: string | null = null,
  ): Promise<void> {
    const normalized = storedIdentifierValue(type, value, domain);
    if (!normalized) return;
    try {
      const existing = await this.prisma.productIdentifier.findUnique({
        where: { type_value: { type, value: normalized } },
        select: { id: true, productId: true, variantId: true },
      });
      if (!existing) {
        await this.prisma.productIdentifier.create({
          data: { productId, type, value: normalized, source: 'extension', variantId },
        });
        return;
      }
      // Backfill the variant on an identifier we own; never re-point one that
      // belongs to another product.
      if (variantId && existing.productId === productId && !existing.variantId) {
        await this.prisma.productIdentifier.update({
          where: { id: existing.id },
          data: { variantId },
        });
      }
    } catch (err) {
      this.logger.warn(`Attach identifier failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Absolute Wudly product URL. The slug only needs to END with the id — the
   * web route recovers the id from the tail (see web/src/lib/seo.ts), so a
   * slightly different slug spelling here is harmless.
   */
  private webUrl(product: { id: string; canonicalName: string }): string {
    const slug = normalizeProductName(product.canonicalName).replace(/\s+/g, '-');
    return `${this.webBase()}/produkte/${slug}-${product.id}`;
  }

  private webBase(): string {
    return this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
  }

  private toResolveQuery(input: ProductSightingInput): SightingResolveQuery {
    return {
      type: input.identifierType,
      value: input.identifierValue,
      q: input.title,
      domain: input.domain,
    };
  }

  private get ingestEnabled(): boolean {
    return this.config.get('EXTENSION_SIGHTINGS_ENABLED', { infer: true });
  }
}

/**
 * Shop titles are keyword spam ("XYZ Kopfhörer Bluetooth 5.3 HiFi 120h |
 * IPX7 …"). Both the AI research and the duplicate matcher need the focused
 * core, not the whole banner: cut at the first hard separator, prepend the
 * brand when missing, clamp. Exported for the worker and tests.
 */
export function researchQuery(title: string, brand: string | null): string {
  let core = title.split(/\s*[|,;(]\s*/)[0]?.trim() ?? title.trim();
  // " - " (spaced hyphen) separates marketing claims; hyphens inside model
  // names ("WH-1000XM5") have no surrounding spaces and survive.
  core = core.split(/\s+[-–—]\s+/)[0]?.trim() ?? core;
  if (core.length < 8) core = title.trim().slice(0, 120);
  if (brand && !core.toLowerCase().includes(brand.toLowerCase())) {
    core = `${brand} ${core}`;
  }
  return core.slice(0, 160);
}

/**
 * How an identifier value is stored in (and looked up from) ProductIdentifier,
 * whose unique constraint is GLOBAL over (type, value).
 *
 * EAN/GTIN/ASIN/MPN are worldwide identities and are stored as-is. A SKU is
 * NOT: it is the shop's own article number, and "2982243" at MediaMarkt has
 * nothing to do with "2982243" at Cyberport. Storing it bare would let the
 * first shop that reports an article number hijack every other shop's product
 * with the same number — the same class of permanent mis-binding that already
 * had to be cleaned up once. So SKUs are stored shop-scoped
 * ("mediamarkt:2982243"), and a SKU without a shop simply cannot be used.
 * Exported for the worker and tests.
 */
export function storedIdentifierValue(
  type: ProductIdentifierType,
  value: string,
  domain: string | null,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (type === 'ASIN') return trimmed.toUpperCase();
  if (type !== 'SKU') return trimmed;
  if (!domain) return null;
  return `${shopSource(domain).source}:${trimmed.toUpperCase()}`;
}

/** Slug/title words too generic to identify a product across shops. */
const GENERIC_SLUG_TOKENS = new Set([
  'and', 'der', 'die', 'das', 'ein', 'eine', 'for', 'fur', 'fuer', 'mit', 'oder', 'und', 'von',
  'cm', 'flat', 'curved', 'hd', 'fhd', 'uhd', 'led', 'oled', 'qled', 'lcd', 'neu', 'produkt', 'product',
  'smart', 'tv', 'ultra', 'wlan', 'wifi', 'zoll', 'inch', 'fernseher', 'ambilight', 'hdr',
  'html', 'www', 'schwarz', 'weiss', 'silber', 'grau', 'black', 'white', 'silver',
]);

/**
 * Does the shop URL's slug describe the same product as the title? Shop slugs
 * are derived from the product name, so a slug with product words but ZERO
 * overlap with the title means the two came from different pages (SPA-race
 * hybrid). URLs whose path carries no product words (e.g. amazon.de/dp/ASIN,
 * shop.tld/p/12345) cannot be judged and pass. Exported for tests.
 */
export function titleMatchesProductUrl(title: string, productUrl: string | null | undefined): boolean {
  if (!productUrl) return true;
  let slugTokens: string[];
  try {
    slugTokens = significantTokens(new URL(productUrl).pathname);
  } catch {
    return true;
  }
  if (slugTokens.length < 2) return true;
  const titleTokens = new Set(significantTokens(title));
  return slugTokens.some((token) => titleTokens.has(token));
}

function significantTokens(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(
      (token) => token.length >= 3 && !GENERIC_SLUG_TOKENS.has(token) && !/^\d+$/.test(token),
    );
}

/** First aspect label from a snapshot's Json aspect list ([{key,label,count}]). */
function firstAspectLabel(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value[0];
  if (first && typeof first === 'object' && typeof (first as { label?: unknown }).label === 'string') {
    return (first as { label: string }).label;
  }
  return null;
}

/** First entry of a snapshot's Json string list. */
function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  return typeof value[0] === 'string' && value[0].length > 0 ? value[0] : null;
}

/**
 * Stable ExternalRating source key + display label for a shop host.
 * Known shops get their proper branding; unknown ones fall back to the
 * second-level domain ("shop.example.de" → "example" / "Example").
 */
export function shopSource(domain: string): { source: string; label: string } {
  const host = domain.toLowerCase().replace(/^www\./, '');
  for (const [suffix, label] of Object.entries(SHOP_LABELS)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return { source: suffix.split('.')[0]!, label };
    }
  }
  const parts = host.split('.');
  const sld = (parts.length >= 2 ? parts[parts.length - 2] : host) || 'shop';
  const source = sld.replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'shop';
  return { source, label: source.charAt(0).toUpperCase() + source.slice(1) };
}
