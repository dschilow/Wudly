import { Injectable, NotFoundException } from '@nestjs/common';
import type { RankingEntryDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Highest rebuy score, among products with at least `minExperiences`. */
  async topRebuy(take: number, minExperiences: number): Promise<RankingEntryDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        insightSnapshot: { is: { experienceCount: { gte: minExperiences }, rebuyScore: { not: null } } },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [
        { insightSnapshot: { rebuyScore: 'desc' } },
        { insightSnapshot: { experienceCount: 'desc' } },
      ],
      take,
    });
    return this.toEntries(products, (p) => p.insightSnapshot?.rebuyScore ?? 0);
  }

  /** Highest regret score. */
  async topRegret(take: number, minExperiences: number): Promise<RankingEntryDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        insightSnapshot: { is: { experienceCount: { gte: minExperiences }, regretScore: { not: null } } },
      },
      include: PRODUCT_INCLUDE,
      orderBy: [
        { insightSnapshot: { regretScore: 'desc' } },
        { insightSnapshot: { experienceCount: 'desc' } },
      ],
      take,
    });
    return this.toEntries(products, (p) => p.insightSnapshot?.regretScore ?? 0);
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
      take,
    });
    return this.toEntries(products, (p) => p.insightSnapshot?.experienceCount ?? 0);
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
      take,
    });
    return this.toEntries(products, (p) => p.insightSnapshot?.rebuyScore ?? 0);
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
