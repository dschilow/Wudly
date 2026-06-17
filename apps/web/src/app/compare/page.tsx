import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompareClient } from './CompareClient';
import { PageSkeleton } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Produktvergleich',
  description:
    'Vergleiche Produkte nach Wiederkauf, Regret-Risiko, Datenlage und echten Besitzerstimmen.',
};

export default function ComparePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompareClient />
    </Suspense>
  );
}
