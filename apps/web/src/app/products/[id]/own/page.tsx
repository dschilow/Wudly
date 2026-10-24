import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WouldBuyAgain, type CategoryAspectDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { apiFetch } from '@/lib/api-client';
import { OwnExperienceFlow } from './OwnExperienceFlow';

export const metadata: Metadata = {
  title: 'Ich besitze es',
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ verdict?: string }>;
}

export default async function OwnPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { verdict } = await searchParams;
  // A verdict tapped in the hub or inbox ("?verdict=YES") — the wizard continues after it.
  const initialVerdict = Object.values(WouldBuyAgain).find((value) => value === verdict) ?? null;

  let product;
  try {
    product = await api.products.get(id, { cache: 'no-store' });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Load the category aspect vocabulary for the optional like/dislike step.
  let aspects: CategoryAspectDto[] = [];
  if (product.category) {
    const allAspects = await apiFetch<Record<string, CategoryAspectDto[]>>(
      '/categories/aspects',
      { cache: 'no-store' },
    ).catch(() => ({}) as Record<string, CategoryAspectDto[]>);
    aspects = allAspects[product.category.slug] ?? [];
  }

  return (
    <OwnExperienceFlow
      productId={product.id}
      productName={product.canonicalName}
      aspects={aspects}
      variants={product.variants}
      initialVerdict={initialVerdict}
    />
  );
}
