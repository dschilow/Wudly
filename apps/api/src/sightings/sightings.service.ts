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
    @Inject(ExternalRatingsService) private readonly externalRatings: ExternalRatingsService,
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Record a sighting and resolve it against the catalog in one round trip.
   * With EXTENSION_SIGHTINGS_ENABLED=false (kill switch) this degrades to a
   * pure lookup — the signal keeps working, ingestion stops.
   */
  async resolveAndRecord(input: ProductSightingInput): Promise<SightingResolutionDto> {
    if (!this.qualityGate(input)) return { status: 'rejected', product: null, webUrl: null };
    if (!this.ingestEnabled) return this.resolveOnly(this.toResolveQuery(input));

    const resolved = await this.resolveProduct(
      input.identifierType ?? null,
      input.identifierValue ?? null,
      input.title,
    );
    const row = await this.upsertSighting(input, resolved?.id ?? null);

    // Remember the shop identifier on the matched product so every future
    // sighting of it resolves via the O(1) identifier path, not name matching.
    if (resolved && input.identifierType && input.identifierValue) {
      await this.attachIdentifier(resolved.id, input.identifierType, input.identifierValue);
    }
    // A product exists (matched now or created by an earlier pipeline run)?
    // Apply the shop rating right away — free, attributed Netz-Konsens.
    const productId = resolved?.id ?? row.productId;
    if (productId) await this.applyShopRating(productId, row);

    if (!resolved) return { status: 'queued', product: null, webUrl: null };
    if (resolved.status === 'HIDDEN') return { status: 'rejected', product: null, webUrl: null };
    return {
      status: 'known',
      product: toProductSummaryDto(resolved),
      webUrl: this.webUrl(resolved),
    };
  }

  /** Pure lookup that records nothing — for users who disabled reporting. */
  async resolveOnly(query: SightingResolveQuery): Promise<SightingResolutionDto> {
    const resolved = await this.resolveProduct(
      query.type ?? null,
      query.value ?? null,
      query.q ?? '',
    );
    if (!resolved || resolved.status === 'HIDDEN') {
      return { status: 'queued', product: null, webUrl: null };
    }
    return {
      status: 'known',
      product: toProductSummaryDto(resolved),
      webUrl: this.webUrl(resolved),
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
    return `name:${normalizeProductNameLoose(input.title).slice(0, 120)}@${input.domain.toLowerCase()}`;
  }

  /**
   * Junk that must not enter the queue at all. Deliberately conservative: a
   * false reject only delays a product until someone adds it another way.
   */
  qualityGate(input: Pick<ProductSightingInput, 'title'>): boolean {
    const loose = normalizeProductNameLoose(input.title);
    if (loose.length < 4) return false;
    if (BUNDLE_PATTERN.test(input.title)) return false;
    return true;
  }

  /** DB-only resolution: identifier first (exact), then strong name match. */
  private async resolveProduct(
    type: ProductIdentifierType | null,
    value: string | null,
    title: string,
  ): Promise<ProductWithRelations | null> {
    if (type && value) {
      const types: ProductIdentifierType[] =
        type === 'EAN' || type === 'GTIN' ? ['EAN', 'GTIN'] : [type];
      const identifier = await this.prisma.productIdentifier.findFirst({
        where: { type: { in: types }, value: type === 'ASIN' ? value.toUpperCase() : value },
        include: { product: { include: PRODUCT_INCLUDE } },
      });
      if (identifier?.product) return identifier.product;
    }
    if (title.trim().length < 4) return null;
    const candidates = await this.matching.findDuplicateCandidates(title, 3);
    const strong = candidates.find(
      (c) => c.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate,
    );
    return strong?.product ?? null;
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
  ): Promise<void> {
    const normalized = type === 'ASIN' ? value.toUpperCase() : value.trim();
    try {
      await this.prisma.productIdentifier.upsert({
        where: { type_value: { type, value: normalized } },
        create: { productId, type, value: normalized, source: 'extension' },
        update: {},
      });
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
    const base = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    const slug = normalizeProductName(product.canonicalName).replace(/\s+/g, '-');
    return `${base}/produkte/${slug}-${product.id}`;
  }

  private toResolveQuery(input: ProductSightingInput): SightingResolveQuery {
    return {
      type: input.identifierType,
      value: input.identifierValue,
      q: input.title,
    };
  }

  private get ingestEnabled(): boolean {
    return this.config.get('EXTENSION_SIGHTINGS_ENABLED', { infer: true });
  }
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
