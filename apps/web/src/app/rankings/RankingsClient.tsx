'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, TriangleAlert, Flame, BarChart3, type LucideIcon } from 'lucide-react';
import type { CategoryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, Skeleton } from '@/components/states/States';
import { cn } from '@/lib/utils';

type Tab = 'rebuy' | 'regret' | 'discussed';

const TABS: { id: Tab; label: string; icon: LucideIcon; emphasis: 'rebuy' | 'regret' }[] = [
  { id: 'rebuy', label: 'Top Wiederkauf', icon: Trophy, emphasis: 'rebuy' },
  { id: 'regret', label: 'Größte Fehlkäufe', icon: TriangleAlert, emphasis: 'regret' },
  { id: 'discussed', label: 'Meist diskutiert', icon: Flame, emphasis: 'rebuy' },
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

  const emphasis = category ? 'rebuy' : (TABS.find((t) => t.id === tab)?.emphasis ?? 'rebuy');

  return (
    <div className="space-y-5">
      <div className="animate-rise">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Top &amp; Flop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entdecke, was sich lohnt — und was nicht.
        </p>
      </div>

      {/* Tabs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = !category && tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setCategory('');
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95',
                active
                  ? 'bg-ink text-white shadow-sm'
                  : 'bg-surface text-ink ring-1 ring-border hover:bg-surface-sunken',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setCategory('')}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
              !category
                ? 'bg-accent text-white'
                : 'bg-surface text-muted-foreground ring-1 ring-border hover:text-ink',
            )}
          >
            Alle Kategorien
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                category === c.slug
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted-foreground ring-1 ring-border hover:text-ink',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[5.5rem]" />
          ))}
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-2.5">
          {entries.map((entry) => (
            <ProductCard
              key={entry.product.id}
              product={entry.product}
              rank={entry.rank}
              emphasis={emphasis}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="Noch keine Platzierungen"
          description="Sobald genügend Erfahrungen vorliegen, erscheinen hier Rankings."
        />
      )}
    </div>
  );
}
