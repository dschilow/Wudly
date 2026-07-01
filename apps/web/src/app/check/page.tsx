import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { CategoryDto, ProductSummaryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { CheckClient } from './CheckClient';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { PageSkeleton } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Wudly — Würden echte Besitzer es wieder kaufen?',
  description:
    'Recherchiere Produkte mit echten Besitzer-Erfahrungen nach echter Nutzung: Wiederkauf-Score, Regret-Score, häufige Probleme und Fragen an echte Besitzer — keine gekauften Sterne.',
  alternates: { canonical: '/' },
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
  const [categories, popular, freshlyAdded] = await Promise.all([
    safe(api.categories.list({ next: { revalidate: 300 } }), [] as CategoryDto[]),
    safe(api.rankings.topRebuy(6, { next: { revalidate: 60 } }), [] as RankingEntryDto[]),
    safe(api.products.newest(6, { next: { revalidate: 120 } }), [] as ProductSummaryDto[]),
  ]);

  const featured: ProductSummaryDto[] = popular.map((e) => e.product);

  return (
    <>
      <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
      <Suspense fallback={<PageSkeleton />}>
        <CheckClient categories={categories} featured={featured} freshlyAdded={freshlyAdded} />
      </Suspense>
    </>
  );
}
