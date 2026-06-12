'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Camera, Loader2, Plus, ScanLine, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import type {
  CategoryDto,
  ExternalProductSuggestionDto,
  IdentifiedProductDto,
  ProductSummaryDto,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ProductList } from '@/components/ProductList';
import { Thumb } from '@/components/Thumb';
import { WaveLines } from '@/components/motion/WaveLines';
import { EmptyState, Skeleton } from '@/components/states/States';
import { AddProductForm } from './AddProductForm';
import { CameraScanner } from './CameraScanner';

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

/**
 * Does any catalog hit actually contain every word of the query? The fuzzy
 * search returns near-misses by design; only a token-complete hit counts as
 * "found" — everything else should additionally trigger the market lookup.
 */
function hasStrongLocalMatch(q: string, found: ProductSummaryDto[]): boolean {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return found.length > 0;
  return found.some((p) => {
    const name = `${p.brand ?? ''} ${p.canonicalName}`.toLowerCase();
    return tokens.every((t) => name.includes(t));
  });
}

function signalLabel(product: ProductSummaryDto) {
  if (product.experienceCount < 20) return 'Frühes Signal';
  if (product.experienceCount < 80) return 'Erste Tendenz';
  if (product.experienceCount < 250) return 'Belastbare Tendenz';
  return 'Starkes Langzeitsignal';
}

/** A recently-checked product as a compact receipt line: name · signal ····· score. */
function RecentProduct({ product }: { product: ProductSummaryDto }) {
  const yes =
    product.rebuyScore === null
      ? null
      : Math.round((product.rebuyScore / 100) * product.ownerCount);
  const scoreText =
    product.rebuyScore === null
      ? '–'
      : product.experienceCount < 20 && yes !== null
        ? `${yes}/${product.ownerCount}`
        : `${product.rebuyScore}%`;

  return (
    <Link href={`/products/${product.id}`} className="card press flex items-center gap-3.5 p-3">
      <Thumb product={product} className="h-16 w-16" rounded="rounded-[0.8rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className="mono-data mt-1 truncate text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
          {signalLabel(product)}
        </p>
      </div>
      <span className="font-display shrink-0 text-[1.75rem] leading-none text-accent-ink">
        {scoreText}
      </span>
    </Link>
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
  const router = useRouter();
  const ownIntent = searchParams.get('own') === '1';
  const scanIntent = searchParams.get('scan') === '1';
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [results, setResults] = useState<ProductSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  // Real-market suggestions (no AI) when the catalog has no strong match.
  const [extSuggestions, setExtSuggestions] = useState<ExternalProductSuggestionDto[] | null>(null);
  const [extLoading, setExtLoading] = useState(false);
  const [creatingEan, setCreatingEan] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (extDebounceRef.current) clearTimeout(extDebounceRef.current);
    if (q.trim().length < 2) {
      setResults(null);
      setExtSuggestions(null);
      setExtLoading(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await api.products.search(q, 12, { cache: 'no-store' });
      setResults(found);

      // The fuzzy catalog search almost always returns *something* — market
      // suggestions must also appear when none of the hits really matches the
      // query (e.g. "iPhone 17" finding only an old iPhone 14 entry).
      if (q.trim().length >= 3 && !hasStrongLocalMatch(q, found)) {
        // Extra debounce: the trial quota (~100/day) shouldn't burn while typing.
        setExtLoading(true);
        extDebounceRef.current = setTimeout(async () => {
          try {
            const ext = await api.products.externalSuggestions(q, { cache: 'no-store' });
            setExtSuggestions(ext);
          } catch {
            setExtSuggestions([]);
          } finally {
            setExtLoading(false);
          }
        }, 550);
      } else {
        setExtSuggestions(null);
        setExtLoading(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Suche fehlgeschlagen.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** A market suggestion was tapped: resolve its EAN (Icecat first) → product page. */
  const handlePickSuggestion = useCallback(
    async (suggestion: ExternalProductSuggestionDto) => {
      if (creatingEan) return;
      navigator.vibrate?.(10);
      setCreatingEan(suggestion.ean);
      try {
        const res = await api.products.resolveEan(suggestion.ean, { cache: 'no-store' });
        if (res.product) {
          router.push(`/products/${res.product.id}`);
          return;
        }
        // EAN chain failed → prefill the manual add form with the real name.
        setQuery(suggestion.title);
        setShowAdd(true);
      } catch {
        setQuery(suggestion.title);
        setShowAdd(true);
      } finally {
        setCreatingEan(null);
      }
    },
    [creatingEan, router],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    if (scanIntent) setScannerOpen(true);
  }, [scanIntent]);

  const handleResearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2 || researching) return;
    setResearching(true);
    navigator.vibrate?.(12);
    try {
      const res = await api.products.research(q);
      if (res.product) {
        router.push(`/products/${res.product.id}`);
        return;
      }
      setShowAdd(true);
    } catch {
      setShowAdd(true);
    } finally {
      setResearching(false);
    }
  }, [query, researching, router]);

  const handleDetected = useCallback(
    async (code: string) => {
      setScannerOpen(false);
      setShowAdd(false);
      setScanNotice('Barcode erkannt');
      try {
        const res = await api.products.resolveEan(code, { cache: 'no-store' });
        if (res.product) {
          router.push(`/products/${res.product.id}`);
          return;
        }
        if (res.suggestion) {
          setScanNotice(`Erkannt: ${res.suggestion.title}`);
          setQuery(res.suggestion.title);
          void runSearch(res.suggestion.title);
          return;
        }
      } catch {
        // Search the raw code when resolution fails.
      }
      setQuery(code);
      void runSearch(code);
    },
    [router, runSearch],
  );

  const handleIdentified = useCallback(
    async (result: IdentifiedProductDto, imageDataUrl: string) => {
      setScannerOpen(false);
      setShowAdd(false);
      const label = [result.brand, result.product].filter(Boolean).join(' ') || result.query;
      setScanNotice(`Erkannt: ${label}`);
      try {
        const res = await api.products.fromPhoto({
          brand: result.brand ?? undefined,
          product: result.product ?? undefined,
          category: result.category ?? undefined,
          imageDataUrl,
        });
        if (res.product) {
          router.push(`/products/${res.product.id}`);
          return;
        }
      } catch {
        // Fall back to text search.
      }
      setQuery(result.query);
      void runSearch(result.query);
    },
    [router, runSearch],
  );

  const idle = query.trim().length === 0;
  const hasNoResults = results !== null && results.length === 0 && !loading;

  return (
    <motion.div
      className="space-y-7 pt-4"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden"
      animate="show"
    >
      <CameraScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetected}
        onIdentified={handleIdentified}
      />

      {/* Editorial hero — the brand question, serif with an italic accent. */}
      <motion.section variants={rise} transition={{ type: 'spring', stiffness: 340, damping: 34 }}>
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Prüfen
        </p>
        <h1 className="font-display mt-2.5 text-balance text-[3rem] leading-[1.0] text-label">
          Würdest du es <em className="text-accent-ink">wieder</em> kaufen?
        </h1>
        <p className="mt-3 max-w-[28rem] text-[1.0625rem] leading-snug text-muted-foreground">
          Suche oder scanne ein Produkt — und sieh, was echte Besitzer nach echter Nutzung sagen.
        </p>
      </motion.section>

      {/* Search with embedded scan action — one control, no extra scroll. */}
      <motion.div variants={rise}>
        <div className="flex h-[4rem] items-center gap-3 rounded-full bg-surface pl-5 pr-2 shadow-[0_0_0_1px_var(--color-border),var(--shadow-card)] transition-shadow duration-300 focus-within:shadow-[0_0_0_2px_var(--color-accent),var(--shadow-elevated)]">
          <Search className="h-[1.4rem] w-[1.4rem] shrink-0 text-faint" strokeWidth={2.1} />
          <input
            autoFocus={!scanIntent && !ownIntent}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAdd(false);
              setScanNotice(null);
            }}
            placeholder="Produkt, Marke oder Link"
            className="h-full min-w-0 flex-1 bg-transparent text-[1.125rem] text-label outline-none placeholder:text-faint"
            inputMode="search"
            aria-label="Produktname, Marke oder Link"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setScanNotice(null);
              }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fill-2 text-muted-foreground"
              aria-label="Suche leeren"
              type="button"
            >
              <X className="h-4 w-4" strokeWidth={2.6} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(8);
              setScannerOpen(true);
            }}
            className="press brand-gradient grid h-[3rem] w-[3rem] shrink-0 place-items-center rounded-full text-[#f1efe6] shadow-[var(--shadow-glow)]"
            aria-label="Produkt scannen"
          >
            <Camera className="h-[1.45rem] w-[1.45rem]" strokeWidth={2.2} />
          </button>
        </div>
        <p className="mono-data mt-2.5 flex items-center justify-center gap-2 text-[0.625rem] uppercase tracking-[0.26em] text-faint">
          <ScanLine className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Scannen · Signal sehen · Entscheiden
        </p>
      </motion.div>

      {scanNotice && (
        <motion.div
          variants={rise}
          className="flex items-center gap-2 rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-[0.9375rem] font-medium text-accent-ink"
        >
          <ShieldCheck className="h-5 w-5 shrink-0" strokeWidth={2.3} />
          {scanNotice}
        </motion.div>
      )}

      {!idle && (
        <motion.section variants={rise}>
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

          {/* Real-market hits by name (no AI) — shown whenever the catalog has
              no strong match, ALSO underneath near-miss local results. */}
          {!showAdd && (extLoading || (extSuggestions && extSuggestions.length > 0)) && (
            <div className="mt-4 space-y-4">
              {extLoading && (
                <div className="space-y-2">
                  <p className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Im Markt suchen …
                  </p>
                  <div className="card overflow-hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={i < 2 ? 'hairline px-4 py-3' : 'px-4 py-3'}>
                        <Skeleton className="h-11" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!extLoading && extSuggestions && extSuggestions.length > 0 && (
                <section className="space-y-2">
                  <p className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Im Markt gefunden
                  </p>
                  <div className="card overflow-hidden">
                    {extSuggestions.map((s, i) => {
                      const busy = creatingEan === s.ean;
                      return (
                        <button
                          key={s.ean}
                          type="button"
                          onClick={() => void handlePickSuggestion(s)}
                          disabled={creatingEan !== null}
                          className={
                            'tap flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60 ' +
                            (i < extSuggestions.length - 1 ? 'hairline' : '')
                          }
                          style={{ ['--hairline-inset' as string]: '4.4rem' }}
                        >
                          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[0.7rem] bg-surface-muted">
                            {s.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.image}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Search className="h-5 w-5 text-faint" strokeWidth={2} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-[0.9375rem] font-medium leading-snug text-label">
                              {s.title}
                            </span>
                            <span className="mono-data mt-0.5 block text-[0.625rem] uppercase tracking-[0.12em] text-faint">
                              {s.brand ?? 'Markt-Treffer'} · EAN {s.ean}
                            </span>
                          </span>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
                            ) : (
                              <Plus className="h-4 w-4" strokeWidth={2.6} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="px-1 text-[0.8125rem] leading-snug text-muted-foreground">
                    Echte Marktprodukte aus offenen EAN-Datenbanken. Tippen legt das Produkt mit
                    offiziellen Daten an.
                  </p>
                </section>
              )}
            </div>
          )}

          {/* Nothing at all in the catalog → AI research as the last resort. */}
          {hasNoResults && !showAdd && !extLoading && (
            <EmptyState
              className="py-8"
              title={
                extSuggestions && extSuggestions.length > 0
                  ? 'Nicht dabei?'
                  : 'Kein Produkt gefunden'
              }
              description={
                extSuggestions && extSuggestions.length > 0
                  ? 'Lass die KI nach genau deinem Produkt suchen.'
                  : `Für "${query}" gibt es noch keinen Eintrag.`
              }
              action={
                <button
                  onClick={handleResearch}
                  disabled={researching}
                  className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[1rem] font-semibold text-[#f1efe6] disabled:opacity-70"
                >
                  {researching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  Finden &amp; anlegen
                </button>
              }
            />
          )}
          {hasNoResults && showAdd && <AddProductForm initialName={query} ownIntent={ownIntent} />}
        </motion.section>
      )}

      {idle && (
        <>
          {featured.length > 0 && (
            <motion.section variants={rise} className="space-y-3">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Zuletzt geprüft
                </h2>
                <Link
                  href="/rankings"
                  className="tap-dim mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent"
                >
                  Alle
                </Link>
              </div>
              <div className="space-y-2.5">
                {featured.slice(0, 3).map((product) => (
                  <RecentProduct key={product.id} product={product} />
                ))}
              </div>
            </motion.section>
          )}

          {categories.length > 0 && (
            <motion.section variants={rise} className="space-y-3">
              <h2 className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Kategorien
              </h2>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {categories.slice(0, 8).map((category) => (
                  <Link
                    key={category.id}
                    href={`/rankings?cat=${category.slug}`}
                    className="press mono-data inline-flex shrink-0 items-center rounded-full bg-surface px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-label shadow-[0_0_0_1px_var(--color-border),var(--shadow-xs)]"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </motion.section>
          )}

          {/* The manifest — what makes the Wudly Signal different. */}
          <motion.section
            variants={rise}
            className="card-elevated relative overflow-hidden p-5"
          >
            <div aria-hidden className="absolute inset-0 text-accent">
              <WaveLines opacity={0.09} />
            </div>
            <p className="mono-data relative text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-accent-ink">
              Das Wudly Signal
            </p>
            <p className="font-display relative mt-2.5 text-[1.6rem] italic leading-snug text-label">
              Echte Besitzer. Nach echter Nutzung. Keine Sterne-Show.
            </p>
            <div className="relative mt-4 space-y-2">
              <p className="ledger-row">
                <span className="text-[0.875rem] text-muted-foreground">Bewertungen</span>
                <span className="leader" aria-hidden />
                <span className="mono-data text-[0.875rem] font-semibold text-label">
                  nur von Besitzern
                </span>
              </p>
              <p className="ledger-row">
                <span className="text-[0.875rem] text-muted-foreground">Gezählt wird</span>
                <span className="leader" aria-hidden />
                <span className="mono-data text-[0.875rem] font-semibold text-label">
                  Wiederkauf, keine Sterne
                </span>
              </p>
              <p className="ledger-row">
                <span className="text-[0.875rem] text-muted-foreground">Werbung im Score</span>
                <span className="leader" aria-hidden />
                <span className="mono-data text-[0.875rem] font-semibold text-label">0&nbsp;%</span>
              </p>
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}
