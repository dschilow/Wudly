'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ProductList } from '@/components/ProductList';
import { EmptyState, Skeleton } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
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
    <div className="animate-fade space-y-4 pt-2">
      <LargeTitle
        title={ownIntent ? 'Dein Produkt' : 'Prüfen'}
        subtitle={
          ownIntent
            ? 'Finde dein Produkt und teile deine Erfahrung.'
            : 'Sieh, ob echte Besitzer es wieder kaufen würden.'
        }
      />

      {/* iOS search field */}
      <div className="flex h-9 items-center gap-1.5 rounded-[0.625rem] bg-fill-2 px-2">
        <Search className="h-[1.05rem] w-[1.05rem] shrink-0 text-faint" strokeWidth={2.2} aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowAdd(false);
          }}
          placeholder="Suchen"
          className="h-full flex-1 bg-transparent text-[1.0625rem] text-label outline-none placeholder:text-faint"
          inputMode="search"
          aria-label="Produktsuche"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="tap-dim grid h-5 w-5 shrink-0 place-items-center rounded-full bg-faint/60 text-white"
            aria-label="Leeren"
          >
            <X className="h-3 w-3" strokeWidth={3} />
          </button>
        )}
      </div>

      {loading && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={i < 3 ? 'hairline px-4 py-3' : 'px-4 py-3'}>
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

      {!loading && results && results.length > 0 && <ProductList products={results} />}

      {hasNoResults && !showAdd && (
        <EmptyState
          title="Kein Produkt gefunden"
          description={`Für „${query}" gibt es noch keinen Eintrag — schlag es als Erster vor.`}
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="tap-dim inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-accent px-5 text-[1.0625rem] font-semibold text-white"
            >
              Produkt vorschlagen
            </button>
          }
        />
      )}

      {hasNoResults && showAdd && <AddProductForm initialName={query} ownIntent={ownIntent} />}

      {results === null && !loading && (
        <p className="px-1 pt-2 text-[0.9375rem] leading-snug text-muted-foreground">
          Du brauchst keine Modellnummer — der normale Produktname reicht völlig.
        </p>
      )}
    </div>
  );
}
