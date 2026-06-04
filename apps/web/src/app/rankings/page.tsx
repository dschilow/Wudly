import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { CategoryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { RankingsClient } from './RankingsClient';
import { LoadingState } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Top & Flop',
  description:
    'Die Produkte mit dem höchsten Wiederkauf-Score, dem höchsten Regret-Score und den meisten Erfahrungen.',
};

export const revalidate = 30;

export default async function RankingsPage() {
  let categories: CategoryDto[] = [];
  try {
    categories = await api.categories.list({ next: { revalidate: 300 } });
  } catch {
    categories = [];
  }
  return (
    <Suspense fallback={<LoadingState />}>
      <RankingsClient categories={categories} />
    </Suspense>
  );
}
