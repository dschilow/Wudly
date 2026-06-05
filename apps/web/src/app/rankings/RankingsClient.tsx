'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Flame, GitCompareArrows, Radar } from 'lucide-react';
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

export interface RegretRadarEntry {
  slug: string;
  name: string;
  regretScore: number;
  productCount: number;
  productName: string;
}

export function RankingsClient({
  categories,
  initialEntries,
  initialRadar,
}: {
  categories: CategoryDto[];
  initialEntries: RankingEntryDto[];
  initialRadar: RegretRadarEntry[];
}) {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get('cat') ?? '';
  const [tab, setTab] = useState<Tab>('rebuy');
  const [category, setCategory] = useState<string>(
    categories.some((c) => c.slug === initialCat) ? initialCat : '',
  );
  const [entries, setEntries] = useState<RankingEntryDto[] | null>(initialEntries);
  const [loadedKey, setLoadedKey] = useState('rebuy');
  const [loading, setLoading] = useState(false);
  const currentKey = category ? `category:${category}` : tab;

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
      setLoadedKey(currentKey);
    } catch {
      setEntries([]);
      setLoadedKey(currentKey);
    } finally {
      setLoading(false);
    }
  }, [tab, category, currentKey]);

  useEffect(() => {
    if (currentKey === loadedKey) return;
    void load();
  }, [currentKey, loadedKey, load]);

  const emphasis = !category && tab === 'regret' ? 'regret' : 'rebuy';

  return (
    <div className="animate-fade space-y-4 pt-2">
      <LargeTitle title="Regret-Radar" subtitle="Wo Käufer am häufigsten danebenliegen." />

      {initialRadar.length > 0 && <RegretRadar entries={initialRadar} />}

      <Link
        href="/compare"
        className="card press tap flex items-center gap-3 px-4 py-3.5"
      >
        <span className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-glow)]">
          <GitCompareArrows className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.1} />
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
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
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
        <div className="card overflow-hidden">
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

function RegretRadar({ entries }: { entries: RegretRadarEntry[] }) {
  const max = Math.max(...entries.map((entry) => entry.regretScore), 1);

  return (
    <section className="card-elevated overflow-hidden p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-regret-soft text-regret-ink">
          <Radar className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.125rem] font-bold tracking-tight text-label">
            Kategorie-Heatmap
          </h2>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
            Aus Produkten mit den höchsten Regret-Scores berechnet.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            href={`/rankings?cat=${entry.slug}`}
            className="tap block rounded-[0.9rem] bg-surface-2 p-3 ring-1 ring-border"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-label">
                {entry.name}
              </span>
              <span className="tnum text-[1.25rem] font-bold leading-none text-regret">
                {entry.regretScore}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill-2">
              <div
                className="h-full rounded-full bg-regret"
                style={{ width: `${Math.max(10, (entry.regretScore / max) * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-regret-ink" strokeWidth={2.3} />
              <span className="truncate">
                Auffällig: {entry.productName} · {entry.productCount} Produkt
                {entry.productCount === 1 ? '' : 'e'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
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
