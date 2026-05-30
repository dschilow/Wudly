import { Controller, Get } from '@nestjs/common';
import type { CategoryDto, CategoryAspectDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /** All categories (for navigation, filters, product creation). */
  @Get()
  async list(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
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
