import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import ProductOverviewPage, {
  generateMetadata as generateProductMetadata,
  revalidate,
} from '@/app/products/[id]/page';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { productIdFromSlug, productPath } from '@/lib/seo';

export { revalidate };

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
