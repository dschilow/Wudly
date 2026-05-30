import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckClient } from './CheckClient';
import { LoadingState } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Produkt prüfen',
  description: 'Suche ein Produkt und sieh, ob echte Besitzer es wieder kaufen würden.',
};

export default function CheckPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckClient />
    </Suspense>
  );
}
