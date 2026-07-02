'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ProductSummaryDto, PulseWorkspaceDto } from '@wudly/shared';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { productThumbUrl } from '@/lib/product-media';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import { ConfidenceChip, TrendChip, scoreTone } from '@/components/pulse/atoms';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/states/States';

/**
 * Produkte — the watched portfolio: one row per product with health, rebuy,
 * trend and data volume, plus catalog search to add products.
 */
export default function PulseProductsPage() {
  const { periodDays } = usePulse();
  const [data, setData] = useState<PulseWorkspaceDto | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api.pulse
      .workspace(periodDays, { cache: 'no-store' })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [periodDays]);

  useEffect(load, [load]);

  const unwatch = async (watchId: string) => {
    setBusyId(watchId);
    try {
      await api.pulse.unwatch(watchId);
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error || !data)
    return (
      <ErrorState
        description="Das Portfolio konnte nicht geladen werden."
        action={
          <button
            type="button"
            onClick={load}
            className="rounded-full bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-foreground"
          >
            Erneut versuchen
          </button>
        }
      />
    );

  const watchedIds = new Set(data.products.map((p) => p.product.id));

  return (
    <div className="animate-fade space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
            Produkte
          </h1>
          <p className="mt-1 text-[0.92rem] text-muted-foreground">
            Dein beobachtetes Portfolio — sortiert nach Handlungsbedarf (niedrigster Health-Index
            zuerst).
          </p>
        </div>
      </header>

      <AddProductSearch watchedIds={watchedIds} onAdded={load} />

      {data.products.length === 0 ? (
        <EmptyState
          title="Portfolio ist leer"
          description="Suche oben nach deinen Produkten im Wudly-Katalog und füge sie hinzu."
        />
      ) : (
        <div className="card divide-y divide-separator p-0">
          {data.products.map((m) => (
            <div key={m.product.id} className="flex items-center gap-4 p-4">
              <Image
                src={productThumbUrl(m.product)}
                alt=""
                width={52}
                height={52}
                unoptimized
                className="h-13 w-13 shrink-0 rounded-[0.75rem] bg-surface-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/pulse/produkte/${m.product.id}`}
                  className="block truncate font-semibold text-label hover:underline"
                >
                  {m.product.canonicalName}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted-foreground">
                  <span>
                    {m.experienceCount} {m.experienceCount === 1 ? 'Erfahrung' : 'Erfahrungen'}
                    {m.newExperiences > 0 && ` (+${m.newExperiences} neu)`}
                  </span>
                  {m.typicalOwnership && <span>{m.typicalOwnership}</span>}
                  <ConfidenceChip confidence={m.confidence} />
                </div>
              </div>
              <div className="hidden text-center sm:block">
                <div className={cn('font-display text-[1.35rem] font-bold tnum', scoreTone(m.healthIndex))}>
                  {m.healthIndex ?? '–'}
                </div>
                <div className="text-[0.7rem] uppercase tracking-wide text-label-3">Health</div>
              </div>
              <div className="hidden text-center sm:block">
                <div className={cn('font-display text-[1.35rem] font-bold tnum', scoreTone(m.rebuyScore))}>
                  {m.rebuyScore ?? '–'}
                </div>
                <div className="text-[0.7rem] uppercase tracking-wide text-label-3">Wiederkauf</div>
              </div>
              <TrendChip delta={m.trend.delta} />
              <button
                type="button"
                onClick={() => void unwatch(m.watchId!)}
                disabled={busyId === m.watchId}
                title="Aus dem Portfolio entfernen"
                className="rounded-full p-2 text-label-3 hover:bg-fill-2 hover:text-regret"
              >
                {busyId === m.watchId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Catalog search → add to watchlist.
 * ------------------------------------------------------------------ */

function AddProductSearch({
  watchedIds,
  onAdded,
}: {
  watchedIds: Set<string>;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api.products
        .search(q, 8)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const add = async (productId: string) => {
    setAddingId(productId);
    try {
      await api.pulse.watch({ productId });
      setQuery('');
      setResults([]);
      onAdded();
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="relative">
      <div className="card flex items-center gap-2.5 p-3">
        <Search className="h-4.5 w-4.5 shrink-0 text-label-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produkt im Wudly-Katalog suchen und zum Portfolio hinzufügen …"
          className="w-full bg-transparent text-[0.95rem] text-label outline-none placeholder:text-label-3"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-label-3" />}
      </div>
      {results.length > 0 && (
        <div className="card-elevated absolute inset-x-0 top-full z-20 mt-2 max-h-80 divide-y divide-separator overflow-y-auto p-0">
          {results.map((p) => {
            const watched = watchedIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={watched || addingId === p.id}
                onClick={() => void add(p.id)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-fill disabled:opacity-50"
              >
                <Image
                  src={productThumbUrl(p)}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="h-9 w-9 shrink-0 rounded-[0.6rem] bg-surface-muted object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9rem] font-medium text-label">
                    {p.canonicalName}
                  </span>
                  <span className="block text-[0.78rem] text-muted-foreground">
                    {p.experienceCount} Erfahrungen
                    {p.category ? ` · ${p.category.name}` : ''}
                  </span>
                </span>
                {watched ? (
                  <span className="text-[0.78rem] text-label-3">im Portfolio</span>
                ) : addingId === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-label-3" />
                ) : (
                  <Plus className="h-4 w-4 text-accent" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
