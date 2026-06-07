import { Injectable, NotFoundException } from '@nestjs/common';
import {
  isExcludedFromRankings,
  type BlindSpotDto,
  type CategoryOverviewDto,
  type ProductSummaryDto,
  type RankingEntryDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

/**
 * Keep food / drink / regulated goods out of public charts (Wudly is about
 * durable goods). Applied after the DB query because the name-keyword check
 * isn't portable as a Prisma filter; callers over-fetch so the cap still holds.
 */
function moderatePublic(products: ProductWithRelations[]): ProductWithRelations[] {
  return products.filter(
    (p) =>
      !isExcludedFromRankings({
        canonicalName: p.canonicalName,
        categorySlug: p.category?.slug ?? null,
      }),
  );
}

export interface RegretCardDto {
  id: string;
  product: ProductSummaryDto;
  quote: string;
  regretScore: number | null;
  ownerCount: number;
}

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Highest rebuy score, among products with at least `minExperiences`. */
  async topRebuy(take: number, minExperiences: number): Promise<RankingEntryDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        insightSnapshot: {
          is: { experienceCount: { gte: minExperiences }, rebuyScore: { not: null } },
        },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [
        { insightSnapshot: { rebuyScore: 'desc' } },
        { insightSnapshot: { experienceCount: 'desc' } },
      ],
      take: take * 3,
    });
    return this.toEntries(
      moderatePublic(products).slice(0, take),
      (p) => p.insightSnapshot?.rebuyScore ?? 0,
    );
  }

  /** Highest regret score. */
  async topRegret(take: number, minExperiences: number): Promise<RankingEntryDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        insightSnapshot: {
          is: { experienceCount: { gte: minExperiences }, regretScore: { not: null } },
        },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [
        { insightSnapshot: { regretScore: 'desc' } },
        { insightSnapshot: { experienceCount: 'desc' } },
      ],
      take: take * 3,
    });
    return this.toEntries(
      moderatePublic(products).slice(0, take),
      (p) => p.insightSnapshot?.regretScore ?? 0,
    );
  }

  /** Most discussed = most experiences (a good proxy in the MVP). */
  async mostDiscussed(take: number, minExperiences: number): Promise<RankingEntryDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        insightSnapshot: { is: { experienceCount: { gte: minExperiences } } },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }],
      take: take * 3,
    });
    return this.toEntries(
      moderatePublic(products).slice(0, take),
      (p) => p.insightSnapshot?.experienceCount ?? 0,
    );
  }

  /** Shareable "wish I knew this before" cards, biased toward high-regret products. */
  async regretCards(take: number, minExperiences: number): Promise<RegretCardDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        insightSnapshot: {
          is: {
            experienceCount: { gte: minExperiences },
            regretScore: { not: null },
          },
        },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [
        { insightSnapshot: { regretScore: 'desc' } },
        { insightSnapshot: { experienceCount: 'desc' } },
      ],
      take: Math.max(take * 4, take),
    });

    return moderatePublic(products)
      .flatMap((product) =>
        asStringArray(product.insightSnapshot?.wishKnownHighlights)
          .slice(0, 1)
          .map((quote) => ({
            id: `${product.id}:${quote.slice(0, 32)}`,
            product: toProductSummaryDto(product),
            quote,
            regretScore: product.insightSnapshot?.regretScore ?? null,
            ownerCount: product.insightSnapshot?.ownerCount ?? 0,
          })),
      )
      .slice(0, take);
  }

  /** Top rebuy within a single category. */
  async topByCategory(
    categorySlug: string,
    take: number,
    minExperiences: number,
  ): Promise<RankingEntryDto[]> {
    const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) throw new NotFoundException('Kategorie nicht gefunden.');

    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        categoryId: category.id,
        insightSnapshot: { is: { experienceCount: { gte: minExperiences } } },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [
        { insightSnapshot: { rebuyScore: 'desc' } },
        { insightSnapshot: { experienceCount: 'desc' } },
      ],
      take: take * 3,
    });
    return this.toEntries(
      moderatePublic(products).slice(0, take),
      (p) => p.insightSnapshot?.rebuyScore ?? 0,
    );
  }

  /**
   * SEO category landing data: top picks, flops, average score, seal count and
   * the category "blind spot" (most common "wish I'd known"). One query, ranked
   * client-side so we don't round-trip per section.
   */
  async categoryOverview(categorySlug: string, take = 5): Promise<CategoryOverviewDto> {
    const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) throw new NotFoundException('Kategorie nicht gefunden.');

    const products = moderatePublic(
      await this.prisma.product.findMany({
        where: { status: 'ACTIVE', categoryId: category.id },
        include: PRODUCT_INCLUDE,
        orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }],
      }),
    );

    const rated = products.filter((p) => (p.insightSnapshot?.rebuyScore ?? null) !== null);

    const averageRebuyScore =
      rated.length === 0
        ? null
        : Math.round(
            rated.reduce((sum, p) => sum + (p.insightSnapshot?.rebuyScore ?? 0), 0) / rated.length,
          );

    const top = [...rated]
      .sort(
        (a, b) =>
          (b.insightSnapshot?.rebuyScore ?? 0) - (a.insightSnapshot?.rebuyScore ?? 0) ||
          (b.insightSnapshot?.experienceCount ?? 0) - (a.insightSnapshot?.experienceCount ?? 0),
      )
      .slice(0, take)
      .map(toProductSummaryDto);

    const flops = products
      .filter((p) => (p.insightSnapshot?.regretScore ?? null) !== null)
      .sort(
        (a, b) =>
          (b.insightSnapshot?.regretScore ?? 0) - (a.insightSnapshot?.regretScore ?? 0) ||
          (b.insightSnapshot?.experienceCount ?? 0) - (a.insightSnapshot?.experienceCount ?? 0),
      )
      .slice(0, take)
      .map(toProductSummaryDto);

    const sealCount = products.filter((p) => p.insightSnapshot?.wudlySeal).length;

    // Blind spot = the most common "wish I'd known" across the category's snapshots.
    const blindSpot = pickBlindSpot(
      products.flatMap((p) => asStringArray(p.insightSnapshot?.wishKnownHighlights)),
    );

    return {
      category: { id: category.id, slug: category.slug, name: category.name },
      productCount: products.length,
      averageRebuyScore,
      top,
      flops,
      sealCount,
      blindSpot,
    };
  }

  /**
   * The Regret-Radar "blind spots": per category, the most common thing owners
   * wish they'd known. A free, shareable public report (organic traffic / PR).
   */
  async blindSpots(): Promise<BlindSpotDto[]> {
    const products = moderatePublic(
      await this.prisma.product.findMany({
        where: { status: 'ACTIVE', categoryId: { not: null } },
        include: PRODUCT_INCLUDE,
      }),
    );

    const byCategory = new Map<
      string,
      { category: { id: string; slug: string; name: string }; quotes: string[]; regrets: number[] }
    >();

    for (const p of products) {
      if (!p.category) continue;
      const group = byCategory.get(p.category.slug) ?? {
        category: { id: p.category.id, slug: p.category.slug, name: p.category.name },
        quotes: [],
        regrets: [],
      };
      group.quotes.push(...asStringArray(p.insightSnapshot?.wishKnownHighlights));
      const regret = p.insightSnapshot?.regretScore;
      if (regret !== null && regret !== undefined) group.regrets.push(regret);
      byCategory.set(p.category.slug, group);
    }

    const result: BlindSpotDto[] = [];
    for (const group of byCategory.values()) {
      const blindSpot = pickBlindSpot(group.quotes);
      if (!blindSpot) continue;
      const averageRegretScore =
        group.regrets.length === 0
          ? null
          : Math.round(group.regrets.reduce((a, b) => a + b, 0) / group.regrets.length);
      result.push({
        category: group.category,
        blindSpot,
        productCount: group.quotes.length,
        averageRegretScore,
      });
    }

    return result.sort((a, b) => (b.averageRegretScore ?? 0) - (a.averageRegretScore ?? 0));
  }

  private toEntries(
    products: ProductWithRelations[],
    metric: (p: ProductWithRelations) => number,
  ): RankingEntryDto[] {
    return products.map((product, index) => ({
      rank: index + 1,
      product: toProductSummaryDto(product),
      metricValue: metric(product),
    }));
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * Pick the category's "blind spot" from all "wish I'd known" quotes. We group by
 * a coarse keyword signature so near-duplicate phrasings cluster, then return the
 * most representative original quote. Falls back to the longest single quote.
 */
function pickBlindSpot(quotes: string[]): string | null {
  if (quotes.length === 0) return null;

  const clusters = new Map<string, { count: number; text: string }>();
  for (const quote of quotes) {
    const sig = quote
      .toLowerCase()
      .replace(/[^a-zäöüß0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .sort()
      .slice(0, 4)
      .join(' ');
    const key = sig || quote.toLowerCase().slice(0, 24);
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      if (quote.length < existing.text.length) existing.text = quote;
    } else {
      clusters.set(key, { count: 1, text: quote });
    }
  }

  return [...clusters.values()].sort(
    (a, b) => b.count - a.count || a.text.length - b.text.length,
  )[0]!.text;
}
