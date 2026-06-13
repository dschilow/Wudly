import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { CategoryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/states/States';
import { RankingsClient } from './RankingsClient';

export const metadata: Metadata = {
  title: 'Entdecken',
  description: 'Produkte entdecken, die sich nach echter Nutzung wirklich lohnen.',
};

export const revalidate = 30;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function RankingsPage() {
  const [categories, rebuy, regret, discussed] = await Promise.all([
    safe(api.categories.list({ next: { revalidate: 300 } }), [] as CategoryDto[]),
    safe(api.rankings.topRebuy(30, { next: { revalidate: 30 } }, 20), [] as RankingEntryDto[]),
    safe(api.rankings.topRegret(12, { next: { revalidate: 60 } }, 20), [] as RankingEntryDto[]),
    safe(api.rankings.mostDiscussed(12, { next: { revalidate: 60 } }), [] as RankingEntryDto[]),
  ]);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <RankingsClient categories={categories} rebuy={rebuy} regret={regret} discussed={discussed} />
    </Suspense>
  );
}
