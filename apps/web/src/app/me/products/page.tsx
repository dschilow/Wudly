import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/states/States';
import { MyProductsClient } from './MyProductsClient';

export const metadata: Metadata = {
  title: 'Besitzen',
  robots: { index: false },
};

export default function MyProductsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyProductsClient />
    </Suspense>
  );
}
