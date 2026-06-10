import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExternalRating } from '@prisma/client';
import type { ExternalRatingDto, UpsertExternalRatingInput } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * External rating FACTS from other platforms ("Bewertungen anderswo").
 *
 * Product rule (same as Showcase): these are orientation-only, always carry a
 * source link, and are NEVER read into the Wudly Signal score or the rankings.
 */
@Injectable()
export class ExternalRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string): Promise<ExternalRatingDto[]> {
    const rows = await this.prisma.externalRating.findMany({
      where: { productId },
      orderBy: [{ count: { sort: 'desc', nulls: 'last' } }, { sourceLabel: 'asc' }],
    });
    return rows.map(toExternalRatingDto);
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
    return toExternalRatingDto(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.externalRating.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bewertung nicht gefunden.');
    await this.prisma.externalRating.delete({ where: { id } });
  }
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
