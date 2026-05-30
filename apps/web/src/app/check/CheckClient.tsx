'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, Skeleton } from '@/components/states/States';
import { AddProductForm } from './AddProductForm';

export function CheckClient() {
  const searchParams = useSearchParams();
  const ownIntent = searchParams.get('own') === '1';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await api.products.search(q, 12, { cache: 'no-store' });
      setResults(found);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Suche fehlgeschlagen.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const hasNoResults = results !== null && results.length === 0 && !loading;

  return (
    <div className="space-y-5">
      <div className="animate-rise">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {ownIntent ? 'Welches Produkt besitzt du?' : 'Welches Produkt prüfst du?'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ownIntent
            ? 'Finde dein Produkt und teile in 3 Klicks deine Erfahrung.'
            : 'Sieh, ob echte Besitzer es wieder kaufen würden.'}
        </p>
      </div>

      {/* Search box */}
      <div className="sticky top-14 z-20 -mx-4 bg-surface-muted/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 shadow-card ring-1 ring-border focus-within:ring-2 focus-within:ring-accent">
          <span className="text-lg text-muted-foreground" aria-hidden>
            🔍
          </span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAdd(false);
            }}
            placeholder="z. B. Dyson V15, MacBook Air…"
            className="h-12 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-foreground"
            inputMode="search"
            aria-label="Produktsuche"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-sm font-semibold text-muted-foreground"
              aria-label="Leeren"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {error && <p className="text-sm font-medium text-regret-ink">{error}</p>}

      {!loading && results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {results.length} Treffer
          </p>
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {hasNoResults && !showAdd && (
        <EmptyState
          icon="🧐"
          title="Kein Produkt gefunden"
          description={`Für „${query}" gibt es noch keinen Eintrag. Du kannst es als Erster vorschlagen.`}
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              ＋ Produkt vorschlagen
            </button>
          }
        />
      )}

      {hasNoResults && showAdd && (
        <AddProductForm initialName={query} ownIntent={ownIntent} />
      )}

      {results === null && !loading && (
        <div className="rounded-3xl bg-surface p-5 text-center text-sm text-muted-foreground ring-1 ring-border">
          Tipp: Du brauchst keine Modellnummer. Der normale Produktname reicht völlig.
        </div>
      )}
    </div>
  );
}
