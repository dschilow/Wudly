'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, X, Plus } from 'lucide-react';
import type { ProductDetailDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { productThumbUrl } from '@/lib/product-media';
import { scoreColor, formatScore } from '@/lib/utils';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { EmptyState, Skeleton } from '@/components/states/States';

const MAX_COMPARE = 3;

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') ?? '';

  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  const [products, setProducts] = useState<Record<string, ProductDetailDto>>({});
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(ids.length === 0);

  // Fetch details for any ids we don't have yet.
  useEffect(() => {
    const missing = ids.filter((id) => !products[id]);
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(
      missing.map((id) =>
        api.products
          .get(id, { cache: 'no-store' })
          .then((p) => [id, p] as const)
          .catch(() => null),
      ),
    )
      .then((results) => {
        setProducts((prev) => {
          const next = { ...prev };
          for (const r of results) if (r) next[r[0]] = r[1];
          return next;
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const setIds = useCallback(
    (next: string[]) => {
      const unique = Array.from(new Set(next)).slice(0, MAX_COMPARE);
      const q = unique.length > 0 ? `?ids=${unique.join(',')}` : '';
      router.replace(`/compare${q}`);
    },
    [router],
  );

  const add = (id: string) => {
    if (ids.includes(id)) return;
    setIds([...ids, id]);
    setPicking(false);
  };
  const remove = (id: string) => setIds(ids.filter((x) => x !== id));

  const selected = ids.map((id) => products[id]).filter(Boolean) as ProductDetailDto[];

  return (
    <div className="animate-fade space-y-5 pt-2">
      <LargeTitle title="Vergleichen" subtitle="Welches lohnt sich wirklich mehr?" />

      {/* Selected chips */}
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ids.map((id) => {
            const p = products[id];
            return (
              <span
                key={id}
                className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-full bg-fill-2 py-1.5 pl-2 pr-1 text-[0.875rem] text-label"
              >
                <span className="truncate">{p ? p.canonicalName : '…'}</span>
                <button
                  onClick={() => remove(id)}
                  aria-label="Entfernen"
                  className="tap-dim grid h-5 w-5 shrink-0 place-items-center rounded-full bg-faint/50 text-white"
                >
                  <X className="h-3 w-3" strokeWidth={3} />
                </button>
              </span>
            );
          })}
          {ids.length < MAX_COMPARE && !picking && (
            <button
              onClick={() => setPicking(true)}
              className="tap-dim inline-flex items-center gap-1 rounded-full bg-accent-soft py-1.5 pl-2.5 pr-3 text-[0.875rem] font-medium text-accent"
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Hinzufügen
            </button>
          )}
        </div>
      )}

      {(picking || ids.length === 0) && (
        <ProductPicker excluded={ids} onPick={add} onClose={() => setPicking(false)} />
      )}

      {/* Comparison */}
      {selected.length === 0 && !loading && ids.length === 0 ? (
        <EmptyState
          title="Zwei Produkte wählen"
          description="Such dir zwei (oder drei) Produkte und sieh den direkten Vergleich von Wiederkauf, Regret und Schwächen."
        />
      ) : selected.length < 2 ? (
        <p className="px-1 text-[0.9375rem] text-muted-foreground">
          Füge mindestens ein weiteres Produkt hinzu, um zu vergleichen.
        </p>
      ) : (
        <ComparisonTable products={selected} />
      )}

      {loading && selected.length < ids.length && (
        <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
      )}
    </div>
  );
}

function ProductPicker({
  excluded,
  onPick,
  onClose,
}: {
  excluded: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.products
        .search(query, 8, { cache: 'no-store' })
        .then((r) => setResults(r.filter((p) => !excluded.includes(p.id))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, excluded]);

  return (
    <div className="space-y-2.5 rounded-[var(--radius-lg)] bg-surface p-3">
      <div className="flex h-9 items-center gap-1.5 rounded-[0.625rem] bg-fill-2 px-2">
        <Search className="h-[1.05rem] w-[1.05rem] shrink-0 text-faint" strokeWidth={2.2} aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produkt suchen…"
          className="h-full flex-1 bg-transparent text-[1.0625rem] text-label outline-none placeholder:text-faint"
          inputMode="search"
        />
        {excluded.length > 0 && (
          <button onClick={onClose} className="tap-dim px-1 text-[0.875rem] text-accent">
            Fertig
          </button>
        )}
      </div>

      {loading && <Skeleton className="h-10" />}
      {results && results.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-md)]">
          {results.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className={
                'tap flex w-full items-center gap-3 py-2 text-left ' +
                (i < results.length - 1 ? 'hairline' : '')
              }
              style={{ ['--hairline-inset' as string]: '3rem' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productThumbUrl(p)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-[0.4rem] bg-fill-2 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem] text-label">{p.canonicalName}</span>
                <span className="block truncate text-[0.8125rem] text-muted-foreground">
                  {[p.brand, p.category?.name].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <Plus className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.4} />
            </button>
          ))}
        </div>
      )}
      {results && results.length === 0 && !loading && (
        <p className="px-1 py-2 text-[0.875rem] text-muted-foreground">Nichts gefunden.</p>
      )}
    </div>
  );
}

function ComparisonTable({ products }: { products: ProductDetailDto[] }) {
  const cols = products.length;
  const gridCols = { gridTemplateColumns: `7.5rem repeat(${cols}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
      {/* Product headers */}
      <div className="grid items-end gap-2 p-3 hairline" style={gridCols}>
        <div />
        {products.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`} className="tap-dim flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productThumbUrl(p)}
              alt=""
              className="h-12 w-12 rounded-[0.5rem] bg-fill-2 object-cover"
            />
            <span className="mt-1.5 line-clamp-2 text-[0.8125rem] font-medium leading-tight text-label">
              {p.canonicalName}
            </span>
          </Link>
        ))}
      </div>

      <ScoreRow label="Wiederkauf" products={products} pick={(p) => p.insights.rebuyScore} kind="rebuy" highlight="max" />
      <ScoreRow label="Regret" products={products} pick={(p) => p.insights.regretScore} kind="regret" highlight="min" />
      <MetaRow label="Erfahrungen" products={products} value={(p) => String(p.insights.experienceCount)} />
      <MetaRow label="Besitzer" products={products} value={(p) => String(p.insights.ownerCount)} />
      <ListRow label="Stärken" products={products} items={(p) => p.insights.topPositiveAspects.map((a) => a.label)} tone="positive" />
      <ListRow label="Schwächen" products={products} items={(p) => p.insights.topNegativeAspects.map((a) => a.label)} tone="negative" last />
    </div>
  );
}

function ScoreRow({
  label,
  products,
  pick,
  kind,
  highlight,
}: {
  label: string;
  products: ProductDetailDto[];
  pick: (p: ProductDetailDto) => number | null;
  kind: 'rebuy' | 'regret';
  highlight: 'max' | 'min';
}) {
  const values = products.map(pick);
  const present = values.filter((v): v is number => v !== null);
  const best =
    present.length > 1
      ? highlight === 'max'
        ? Math.max(...present)
        : Math.min(...present)
      : null;

  const cols = products.length;
  return (
    <div
      className="grid items-center gap-2 px-3 py-3 hairline"
      style={{ gridTemplateColumns: `7.5rem repeat(${cols}, minmax(0, 1fr))` }}
    >
      <span className="text-[0.875rem] text-muted-foreground">{label}</span>
      {values.map((v, i) => {
        const isBest = best !== null && v === best;
        return (
          <span key={i} className="flex items-center justify-center">
            <span
              className="text-[1.375rem] font-semibold tnum leading-none"
              style={{ color: scoreColor(v, kind) }}
            >
              {formatScore(v)}
            </span>
            {isBest && (
              <span className="ml-1.5 rounded-full bg-positive-soft px-1.5 py-0.5 text-[0.625rem] font-bold text-positive-ink">
                BEST
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function MetaRow({
  label,
  products,
  value,
}: {
  label: string;
  products: ProductDetailDto[];
  value: (p: ProductDetailDto) => string;
}) {
  const cols = products.length;
  return (
    <div
      className="grid items-center gap-2 px-3 py-2.5 hairline"
      style={{ gridTemplateColumns: `7.5rem repeat(${cols}, minmax(0, 1fr))` }}
    >
      <span className="text-[0.875rem] text-muted-foreground">{label}</span>
      {products.map((p, i) => (
        <span key={i} className="text-center text-[0.9375rem] tnum text-label">
          {value(p)}
        </span>
      ))}
    </div>
  );
}

function ListRow({
  label,
  products,
  items,
  tone,
  last,
}: {
  label: string;
  products: ProductDetailDto[];
  items: (p: ProductDetailDto) => string[];
  tone: 'positive' | 'negative';
  last?: boolean;
}) {
  const cols = products.length;
  const dot = tone === 'positive' ? 'bg-positive' : 'bg-regret';
  return (
    <div
      className={'grid gap-2 px-3 py-3 ' + (last ? '' : 'hairline')}
      style={{ gridTemplateColumns: `7.5rem repeat(${cols}, minmax(0, 1fr))` }}
    >
      <span className="text-[0.875rem] text-muted-foreground">{label}</span>
      {products.map((p, i) => {
        const list = items(p).slice(0, 4);
        return (
          <ul key={i} className="space-y-1">
            {list.length > 0 ? (
              list.map((it, j) => (
                <li key={j} className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-label">
                  <span className={`mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                  <span className="min-w-0">{it}</span>
                </li>
              ))
            ) : (
              <li className="text-[0.8125rem] text-faint">—</li>
            )}
          </ul>
        );
      })}
    </div>
  );
}
