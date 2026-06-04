'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, X, ChevronRight } from 'lucide-react';
import type { CategoryDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ProductList } from '@/components/ProductList';
import { EmptyState, Skeleton } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { categoryEmoji, categoryTile } from '@/lib/categories';
import { AddProductForm } from './AddProductForm';

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-2 text-[1.0625rem] font-bold tracking-tight text-label">{children}</p>
  );
}

export function CheckClient({
  categories,
  featured,
}: {
  categories: CategoryDto[];
  featured: ProductSummaryDto[];
}) {
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
  const idle = query.trim().length === 0;

  return (
    <div className="animate-fade space-y-5 pt-2">
      <LargeTitle
        title={ownIntent ? 'Dein Produkt' : 'Prüfen'}
        subtitle={
          ownIntent
            ? 'Finde dein Produkt und teile deine Erfahrung.'
            : 'Sieh, ob echte Besitzer es wieder kaufen würden.'
        }
      />

      {/* Search field — substantial, rounded, with a clear affordance */}
      <div className="flex h-12 items-center gap-2 rounded-[0.9rem] bg-fill-2 px-3.5">
        <Search className="h-[1.15rem] w-[1.15rem] shrink-0 text-faint" strokeWidth={2.2} aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowAdd(false);
          }}
          placeholder="Produkt oder Marke suchen"
          className="h-full flex-1 bg-transparent text-[1.0625rem] text-label outline-none placeholder:text-faint"
          inputMode="search"
          aria-label="Produktsuche"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="tap-dim grid h-5 w-5 shrink-0 place-items-center rounded-full bg-faint/70 text-white"
            aria-label="Leeren"
          >
            <X className="h-3 w-3" strokeWidth={3} />
          </button>
        )}
      </div>

      {loading && (
        <div className="card overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={i < 3 ? 'hairline px-4 py-3' : 'px-4 py-3'}>
              <Skeleton className="h-11" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

      {!loading && results && results.length > 0 && <ProductList products={results} />}

      {hasNoResults && !showAdd && (
        <EmptyState
          title="Kein Produkt gefunden"
          description={`Für „${query}" gibt es noch keinen Eintrag – schlag es als Erster vor.`}
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="press inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-accent px-5 text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
            >
              Produkt vorschlagen
            </button>
          }
        />
      )}

      {hasNoResults && showAdd && <AddProductForm initialName={query} ownIntent={ownIntent} />}

      {/* Idle state — browse, never an empty void */}
      {idle && (
        <>
          {categories.length > 0 && (
            <section>
              <GroupLabel>Kategorien</GroupLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/rankings?cat=${c.slug}`}
                    className="card press flex min-h-[4.25rem] items-center gap-3 p-2.5"
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.75rem] text-[1.5rem] ring-1 ring-black/[0.04]"
                      style={{ backgroundImage: categoryTile(c.slug) }}
                    >
                      {categoryEmoji(c.slug, c.name)}
                    </span>
                    <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-tight text-label [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                      {c.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {featured.length > 0 && (
            <section>
              <div className="mb-2 flex items-end justify-between px-1">
                <p className="text-[1.0625rem] font-bold tracking-tight text-label">Beliebt gerade</p>
                <Link
                  href="/rankings"
                  className="tap-dim flex items-center gap-0.5 text-[0.9375rem] font-medium text-accent"
                >
                  Alle
                  <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
                </Link>
              </div>
              <ProductList products={featured} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
