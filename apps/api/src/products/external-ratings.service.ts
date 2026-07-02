import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { ExternalRating } from '@prisma/client';
import {
  aggregateExternalConsensus,
  type ExternalRatingDto,
  type ExternalConsensusDto,
  type ResearchedExternalConsensus,
  type SwitchAlternativeDto,
  type UpsertExternalRatingInput,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * External rating FACTS from other platforms ("Bewertungen anderswo").
 *
 * Product rule (same as Showcase): these are orientation-only, always carry a
 * source link, and are NEVER read into the Wudly Signal score or the rankings.
 */
@Injectable()
export class ExternalRatingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForProduct(productId: string): Promise<ExternalRatingDto[]> {
    const rows = await this.prisma.externalRating.findMany({
      where: { productId },
      orderBy: [{ count: { sort: 'desc', nulls: 'last' } }, { sourceLabel: 'asc' }],
    });
    return rows.map(toExternalRatingDto);
  }

  async getConsensus(productId: string): Promise<ExternalConsensusDto | null> {
    const [row] = await this.prisma.$queryRaw<Array<{
      summary: string | null;
      longTermNote: string | null;
      positiveThemes: unknown;
      negativeThemes: unknown;
      switchAlternatives: unknown;
      sourceUrls: unknown;
      fetchedAt: Date;
    }>>`SELECT "summary", "longTermNote", "positiveThemes", "negativeThemes", "switchAlternatives", "sourceUrls", "fetchedAt"
       FROM "ExternalConsensus" WHERE "productId" = ${productId} LIMIT 1`;
    if (!row) return null;
    return {
      summary: row.summary,
      longTermNote: row.longTermNote,
      positiveThemes: asThemes(row.positiveThemes),
      negativeThemes: asThemes(row.negativeThemes),
      switchAlternatives: asSwitchAlternatives(row.switchAlternatives),
      sourceUrls: asUrls(row.sourceUrls),
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  async isFresh(productId: string, maxAgeDays = 90): Promise<boolean> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const [consensus, rating] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ExternalConsensus"
        WHERE "productId" = ${productId} AND "fetchedAt" >= ${cutoff} LIMIT 1`,
      this.prisma.externalRating.findFirst({
        where: { productId, fetchedAt: { gte: cutoff } },
        select: { id: true },
      }),
    ]);
    return consensus.length > 0 || Boolean(rating);
  }

  /**
   * Persist the researched consensus. `matchedAlternatives` is the catalog-
   * matched shape of `research.switchAlternatives` (with productId); when the
   * caller didn't match, the raw research alternatives are stored unmatched.
   */
  async storeResearch(
    productId: string,
    research: ResearchedExternalConsensus,
    matchedAlternatives?: SwitchAlternativeDto[],
  ): Promise<void> {
    const sourceUrls = [...new Set(research.sourceUrls)].slice(0, 12);
    const positives = JSON.stringify(research.positiveThemes);
    const negatives = JSON.stringify(research.negativeThemes);
    const alternatives = JSON.stringify(
      matchedAlternatives ??
        research.switchAlternatives.map((alt) => ({ ...alt, productId: null })),
    );
    const sources = JSON.stringify(sourceUrls);
    await this.prisma.$executeRaw`
      INSERT INTO "ExternalConsensus"
        ("id", "productId", "summary", "longTermNote", "positiveThemes", "negativeThemes", "switchAlternatives", "sourceUrls", "fetchedAt", "createdAt", "updatedAt")
      VALUES
        (${crypto.randomUUID()}, ${productId}, ${research.summary}, ${research.longTermNote}, ${positives}::jsonb, ${negatives}::jsonb, ${alternatives}::jsonb, ${sources}::jsonb, NOW(), NOW(), NOW())
      ON CONFLICT ("productId") DO UPDATE SET
        "summary" = EXCLUDED."summary",
        "longTermNote" = EXCLUDED."longTermNote",
        "positiveThemes" = EXCLUDED."positiveThemes",
        "negativeThemes" = EXCLUDED."negativeThemes",
        "switchAlternatives" = EXCLUDED."switchAlternatives",
        "sourceUrls" = EXCLUDED."sourceUrls",
        "fetchedAt" = NOW(),
        "updatedAt" = NOW()`;
  }

  async staleProductIds(limit: number, maxAgeDays = 90): Promise<string[]> {
    const cutoff = new Date(Date.now() - maxAgeDays * 86400000);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p."id" FROM "Product" p
      LEFT JOIN "ExternalConsensus" c ON c."productId" = p."id"
      WHERE p."status" <> 'HIDDEN' AND (c."id" IS NULL OR c."fetchedAt" < ${cutoff})
      ORDER BY p."createdAt" ASC LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  async staleProductCount(maxAgeDays = 90): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 86400000);
    const [row] = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count" FROM "Product" p
      LEFT JOIN "ExternalConsensus" c ON c."productId" = p."id"
      WHERE p."status" <> 'HIDDEN' AND (c."id" IS NULL OR c."fetchedAt" < ${cutoff})`;
    return Number(row?.count ?? 0);
  }

  /** Admin upsert, keyed per (product, source) so re-imports just refresh. */
  async upsert(productId: string, input: UpsertExternalRatingInput): Promise<ExternalRatingDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const data = {
      sourceLabel: input.sourceLabel,
      url: input.url,
      kind: input.kind,
      value: input.value,
      maxValue: input.kind === 'PERCENT' ? 100 : input.kind === 'GRADE_DE' ? 6 : input.maxValue,
      count: input.count ?? null,
      note: input.note ?? null,
      fetchedAt: new Date(),
    };
    const row = await this.prisma.externalRating.upsert({
      where: { productId_source: { productId, source: input.source } },
      create: { productId, source: input.source, ...data },
      update: data,
    });
    await this.refreshConsensus(productId);
    return toExternalRatingDto(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.externalRating.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bewertung nicht gefunden.');
    await this.prisma.externalRating.delete({ where: { id } });
    await this.refreshConsensus(existing.productId);
  }

  /**
   * Keep the cached "Netz-Konsens" aggregate on the snapshot in sync after any
   * rating mutation, so cards reflect the change without waiting for the next
   * experience-driven snapshot rebuild. No-op when no snapshot exists yet (the
   * aggregate is computed from scratch on the product's first snapshot).
   */
  private async refreshConsensus(productId: string): Promise<void> {
    const ratings = await this.prisma.externalRating.findMany({
      where: { productId },
      select: { kind: true, value: true, maxValue: true, count: true },
    });
    const consensus = aggregateExternalConsensus(ratings);
    await this.prisma.productInsightSnapshot.updateMany({
      where: { productId },
      data: {
        externalAvgPercent: consensus.avgPercent,
        externalSourceCount: consensus.sourceCount,
      },
    });
  }
}

function asThemes(value: unknown): ExternalConsensusDto['positiveThemes'] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ExternalConsensusDto['positiveThemes'][number] => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return typeof row.label === 'string' && Array.isArray(row.sourceUrls);
  });
}

function asUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string') : [];
}

function asSwitchAlternatives(value: unknown): SwitchAlternativeDto[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((row) => typeof row.name === 'string' && typeof row.reason === 'string')
    .map((row) => ({
      name: row.name as string,
      brand: typeof row.brand === 'string' ? row.brand : null,
      reason: row.reason as string,
      sourceUrls: asUrls(row.sourceUrls),
      productId: typeof row.productId === 'string' ? row.productId : null,
    }));
}

export function toExternalRatingDto(row: ExternalRating): ExternalRatingDto {
  return {
    id: row.id,
    source: row.source,
    sourceLabel: row.sourceLabel,
    url: row.url,
    kind: row.kind,
    value: row.value,
    maxValue: row.maxValue,
    count: row.count,
    note: row.note,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}
