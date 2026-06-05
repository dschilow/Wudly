import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { CategoryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { RankingsClient, type RegretRadarEntry } from './RankingsClient';
import { LoadingState } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Top & Flop',
  description:
    'Die Produkte mit dem höchsten Wiederkauf-Score, dem höchsten Regret-Score und den meisten Erfahrungen.',
};

export const revalidate = 30;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function buildRegretRadar(entries: RankingEntryDto[]): RegretRadarEntry[] {
  const groups = new Map<
    string,
    {
      slug: string;
      name: string;
      total: number;
      count: number;
      max: number;
      productName: string;
    }
  >();

  for (const entry of entries) {
    const category = entry.product.category;
    const regret = entry.product.regretScore;
    if (!category || regret === null) continue;

    const current = groups.get(category.slug) ?? {
      slug: category.slug,
      name: category.name,
      total: 0,
      count: 0,
      max: 0,
      productName: entry.product.canonicalName,
    };
    current.total += regret;
    current.count += 1;
    if (regret >= current.max) {
      current.max = regret;
      current.productName = entry.product.canonicalName;
    }
    groups.set(category.slug, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      slug: group.slug,
      name: group.name,
      regretScore: Math.round(group.total / group.count),
      productCount: group.count,
      productName: group.productName,
    }))
    .sort((a, b) => b.regretScore - a.regretScore)
    .slice(0, 6);
}

export default async function RankingsPage() {
  const [categories, initialEntries, regretEntries] = await Promise.all([
    safe(api.categories.list({ next: { revalidate: 300 } }), [] as CategoryDto[]),
    safe(api.rankings.topRebuy(30, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.topRegret(50, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
  ]);

  return (
    <Suspense fallback={<LoadingState />}>
      <RankingsClient
        categories={categories}
        initialEntries={initialEntries}
        initialRadar={buildRegretRadar(regretEntries)}
      />
    </Suspense>
  );
}
