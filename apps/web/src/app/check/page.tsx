import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { CategoryDto, ProductSummaryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { CheckClient } from './CheckClient';
import { PageSkeleton } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Produkt prüfen',
  description: 'Suche ein Produkt und sieh, ob echte Besitzer es wieder kaufen würden.',
};

export const revalidate = 60;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function CheckPage() {
  const [categories, popular] = await Promise.all([
    safe(api.categories.list({ next: { revalidate: 300 } }), [] as CategoryDto[]),
    safe(api.rankings.topRebuy(6, { next: { revalidate: 60 } }), [] as RankingEntryDto[]),
  ]);

  const featured: ProductSummaryDto[] = popular.map((e) => e.product);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <CheckClient categories={categories} featured={featured} />
    </Suspense>
  );
}
