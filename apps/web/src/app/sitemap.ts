import type { MetadataRoute } from 'next';
import type { CategoryDto, PaginatedDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { siteUrl } from '@/lib/seo';

// Refresh hourly — new products and rankings should reach the index quickly.
export const revalidate = 3600;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/check`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/rankings`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: 'weekly', priority: 0.4 },
  ];

  // Category landing pages — the primary SEO channel ("[Produkt] Erfahrungen").
  const categories = await safe(
    api.categories.list({ next: { revalidate } }),
    [] as CategoryDto[],
  );
  for (const category of categories) {
    routes.push({
      url: `${base}/kategorie/${category.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Product pages — paginate (API caps take at 100) up to a sane bound.
  const PAGE = 100;
  const products: ProductSummaryDto[] = [];
  for (let skip = 0; skip < 1000; skip += PAGE) {
    const page = await safe(
      api.products.list({ take: PAGE, skip }, { next: { revalidate } }),
      { items: [], total: 0, take: PAGE, skip } as PaginatedDto<ProductSummaryDto>,
    );
    products.push(...page.items);
    if (page.items.length < PAGE || skip + PAGE >= page.total) break;
  }
  for (const product of products) {
    routes.push({
      url: `${base}/products/${product.id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return routes;
}
