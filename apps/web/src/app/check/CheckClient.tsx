'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X, PackageSearch, Plus, Lightbulb } from 'lucide-react';
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
      <div className="sticky top-14 z-20 -mx-4 bg-canvas/80 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] bg-surface px-4 shadow-sm ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-accent">
          <Search className="h-[1.15rem] w-[1.15rem] shrink-0 text-faint" strokeWidth={2} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAdd(false);
            }}
            placeholder="z. B. Dyson V15, MacBook Air…"
            className="h-12 flex-1 bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-faint"
            inputMode="search"
            aria-label="Produktsuche"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-sunken hover:text-ink"
              aria-label="Leeren"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-2.5">
          <Skeleton className="h-[5.5rem]" />
          <Skeleton className="h-[5.5rem]" />
          <Skeleton className="h-[5.5rem]" />
        </div>
      )}

      {error && <p className="text-sm font-medium text-regret-ink">{error}</p>}

      {!loading && results && results.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            {results.length} Treffer
          </p>
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {hasNoResults && !showAdd && (
        <EmptyState
          icon={PackageSearch}
          title="Kein Produkt gefunden"
          description={`Für „${query}" gibt es noch keinen Eintrag. Du kannst es als Erster vorschlagen.`}
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-lg)] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} /> Produkt vorschlagen
            </button>
          }
        />
      )}

      {hasNoResults && showAdd && <AddProductForm initialName={query} ownIntent={ownIntent} />}

      {results === null && !loading && (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-unsure" strokeWidth={2} aria-hidden />
          <span>
            <span className="font-semibold text-ink">Tipp:</span> Du brauchst keine Modellnummer. Der
            normale Produktname reicht völlig.
          </span>
        </div>
      )}
    </div>
  );
}
