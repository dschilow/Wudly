import { Controller, Get } from '@nestjs/common';
import type { CategoryDto, CategoryAspectDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All categories (for navigation, filters, product creation), each with the
   * number of active products it holds. Callers that build browse entry points
   * filter on that count — a seeded category with nothing in it would
   * otherwise promise a shelf and deliver an empty page.
   */
  @Get()
  async list(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    });
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      productCount: c._count.products,
    }));
  }

  /** Category aspect vocabulary, keyed by category slug (for the experience flow). */
  @Get('aspects')
  async aspects(): Promise<Record<string, CategoryAspectDto[]>> {
    const categories = await this.prisma.category.findMany({ include: { aspects: true } });
    const result: Record<string, CategoryAspectDto[]> = {};
    for (const cat of categories) {
      result[cat.slug] = cat.aspects.map((a) => ({
        id: a.id,
        key: a.key,
        label: a.label,
        type: a.type,
      }));
    }
    return result;
  }
}
