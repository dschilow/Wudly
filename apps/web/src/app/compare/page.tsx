import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompareClient } from './CompareClient';
import { PageSkeleton } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Vergleichen',
  description: 'Vergleiche Produkte nach Wiederkauf-Score, Stärken und Schwächen.',
};

export default function ComparePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompareClient />
    </Suspense>
  );
}
