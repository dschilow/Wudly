'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import type { CategoryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductList } from '@/components/ProductList';
import { EmptyState, Skeleton } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { SegmentedControl } from '@/components/ios/SegmentedControl';
import { cn } from '@/lib/utils';

type Tab = 'rebuy' | 'regret' | 'discussed';

const SEGMENTS = [
  { value: 'rebuy' as const, label: 'Top' },
  { value: 'regret' as const, label: 'Flop' },
  { value: 'discussed' as const, label: 'Diskutiert' },
];

export function RankingsClient({ categories }: { categories: CategoryDto[] }) {
  const [tab, setTab] = useState<Tab>('rebuy');
  const [category, setCategory] = useState<string>('');
  const [entries, setEntries] = useState<RankingEntryDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: RankingEntryDto[];
      if (category) {
        data = await api.rankings.byCategory(category, 30, { cache: 'no-store' });
      } else if (tab === 'rebuy') {
        data = await api.rankings.topRebuy(30, { cache: 'no-store' });
      } else if (tab === 'regret') {
        data = await api.rankings.topRegret(30, { cache: 'no-store' });
      } else {
        data = await api.rankings.mostDiscussed(30, { cache: 'no-store' });
      }
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [tab, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const emphasis = !category && tab === 'regret' ? 'regret' : 'rebuy';

  return (
    <div className="animate-fade space-y-4 pt-2">
      <LargeTitle title="Charts" subtitle="Was sich lohnt — und was nicht." />

      <Link
        href="/compare"
        className="tap flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-4 py-3"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <GitCompareArrows className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] leading-tight text-label">Produkte vergleichen</span>
          <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">
            Wiederkauf, Regret & Schwächen direkt nebeneinander.
          </span>
        </span>
      </Link>

      <SegmentedControl
        segments={SEGMENTS}
        value={category ? 'rebuy' : tab}
        onChange={(v) => {
          setTab(v);
          setCategory('');
        }}
      />

      {/* Category filter — iOS-style scrolling chips */}
      {categories.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!category} onClick={() => setCategory('')}>
            Alle
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('px-4 py-3', i < 5 && 'hairline')}>
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      ) : entries && entries.length > 0 ? (
        <ProductList
          products={entries.map((e) => ({ product: e.product, rank: e.rank }))}
          emphasis={emphasis}
        />
      ) : (
        <EmptyState
          title="Noch keine Platzierungen"
          description="Sobald genügend Erfahrungen vorliegen, erscheinen hier Rankings."
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'tap-dim shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium',
        active ? 'bg-accent text-white' : 'bg-fill-2 text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
