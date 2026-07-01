import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ProductSummaryDto } from '@wudly/shared';
import ProductOverviewPage, {
  generateMetadata as generateProductMetadata,
  revalidate,
} from '@/app/products/[id]/page';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { productIdFromSlug, productPath, productSlug } from '@/lib/seo';

export { revalidate };

/**
 * Pre-render the most-visited products at build time so their pages are static
 * (instant + reliably crawlable) the moment Google arrives. Any other product
 * still renders on demand and is then cached — `dynamicParams` stays default
 * true, so this is a warm-start list, not an allowlist.
 */
export async function generateStaticParams() {
  try {
    const page = await api.products.list({ take: 100, skip: 0 });
    return page.items.map((product: ProductSummaryDto) => ({ slug: productSlug(product) }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

function productParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const id = productIdFromSlug(slug);
  if (!id) return { title: 'Produkt' };
  return generateProductMetadata({ params: productParams(id) });
}

export default async function SeoProductPage({ params }: PageProps) {
  const { slug } = await params;
  const id = productIdFromSlug(slug);
  if (!id) notFound();

  try {
    const product = await api.products.get(id, { next: { revalidate: 20 } });
    const canonicalPath = productPath(product);
    if (canonicalPath !== `/produkte/${slug}`) redirect(canonicalPath);
    return ProductOverviewPage({ params: productParams(product.id) });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
