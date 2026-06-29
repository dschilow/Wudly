import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/states/States';
import { InboxClient } from './InboxClient';

export const metadata: Metadata = { title: 'Mitteilungen' };

export default function InboxPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InboxClient />
    </Suspense>
  );
}
