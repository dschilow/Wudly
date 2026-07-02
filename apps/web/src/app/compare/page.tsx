import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import { api } from '@/lib/api';
import { comparePairPath } from '@/lib/seo';
import { productThumbUrl } from '@/lib/product-media';
import { CompareClient } from './CompareClient';
import { PageSkeleton } from '@/components/states/States';

export const metadata: Metadata = {
  title: 'Produktvergleich',
  description:
    'Vergleiche Produkte nach Wiederkauf, Regret-Risiko, Datenlage und echten Besitzerstimmen.',
};

async function PopularComparisons() {
  const pairs = await api.products.comparePairs(8, { next: { revalidate: 300 } }).catch(() => []);
  if (pairs.length === 0) return null;

  return (
    <section className="card mx-auto max-w-6xl p-4">
      <p className="mono-data px-1 pb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Beliebte Vergleiche
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {pairs.map((pair) => (
          <Link
            key={`${pair.a.id}-${pair.b.id}`}
            href={comparePairPath(pair)}
            className="tap flex items-center gap-2 rounded-[0.9rem] bg-fill px-3 py-2.5"
          >
            <div className="flex -space-x-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productThumbUrl(pair.a)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full bg-surface-muted object-contain p-1 ring-2 ring-surface"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productThumbUrl(pair.b)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full bg-surface-muted object-contain p-1 ring-2 ring-surface"
              />
            </div>
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-label">
              {pair.a.canonicalName} <span className="text-muted-foreground">vs.</span>{' '}
              {pair.b.canonicalName}
            </span>
            <GitCompareArrows className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.2} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ComparePage() {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <CompareClient />
      </Suspense>
      <Suspense fallback={null}>
        <div className="pb-8 pt-1">
          <PopularComparisons />
        </div>
      </Suspense>
    </>
  );
}
