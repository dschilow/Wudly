'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { CategoryDto, IdentifiedProductDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { categoryTile } from '@/lib/categories';
import { ProductList } from '@/components/ProductList';
import { Thumb } from '@/components/Thumb';
import { WaveLines } from '@/components/motion/WaveLines';
import { EmptyState, Skeleton } from '@/components/states/States';
import { AddProductForm } from './AddProductForm';
import { CameraScanner } from './CameraScanner';

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

/** The hero question, revealed word by word — calm, typographic, Apple-like. */
function HeroTitle({ text }: { text: string }) {
  return (
    <motion.h1
      className="font-display mt-3 text-balance text-[2.85rem] font-semibold leading-[0.99] text-label"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
    >
      {text.split(' ').map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-top">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '105%', opacity: 0 },
              show: { y: 0, opacity: 1 },
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {word}
          </motion.span>
          {' '}
        </span>
      ))}
    </motion.h1>
  );
}

function signalLabel(product: ProductSummaryDto) {
  if (product.experienceCount < 20) return 'Frühes Signal';
  if (product.experienceCount < 80) return 'Erste Tendenz';
  if (product.experienceCount < 250) return 'Belastbare Tendenz';
  return 'Starkes Langzeitsignal';
}

function signalText(product: ProductSummaryDto) {
  const yes =
    product.rebuyScore === null
      ? null
      : Math.round((product.rebuyScore / 100) * product.ownerCount);
  if (product.experienceCount < 20 && yes !== null) {
    return `${signalLabel(product)} · ${yes} von ${product.ownerCount} würden es wieder kaufen`;
  }
  if (product.rebuyScore !== null) {
    return `${signalLabel(product)} · ${product.rebuyScore}% würden es wieder kaufen`;
  }
  return 'Noch kein belastbares Signal';
}

function RecentProduct({ product }: { product: ProductSummaryDto }) {
  return (
    <Link href={`/products/${product.id}`} className="card press flex items-center gap-3 p-3">
      <Thumb product={product} className="h-[4.25rem] w-[4.25rem]" rounded="rounded-[1rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
          {signalText(product)}
        </p>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-positive text-white shadow-[var(--shadow-card)]">
        <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-label-3" strokeWidth={2.4} />
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
      className="space-y-6 pt-2"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      initial="hidden"
      animate="show"
    >
      <CameraScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetected}
        onIdentified={handleIdentified}
      />

      <motion.section variants={rise} transition={{ type: 'spring', stiffness: 360, damping: 34 }}>
        <p className="text-[1.4rem] font-bold leading-none tracking-tight text-label">Prüfen</p>
        <HeroTitle text="Welches Produkt möchtest du prüfen?" />
      </motion.section>

      <motion.div variants={rise} className="space-y-3">
        <div className="flex h-[4.35rem] items-center gap-3 rounded-[1.65rem] bg-surface px-5 shadow-[var(--shadow-card)] ring-1 ring-border transition-shadow duration-300 focus-within:shadow-[var(--shadow-elevated)] focus-within:ring-2 focus-within:ring-accent/25">
          <Search className="h-7 w-7 shrink-0 text-faint" strokeWidth={2.1} />
          <input
            autoFocus={!scanIntent && !ownIntent}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAdd(false);
              setScanNotice(null);
            }}
            placeholder="Produktname, Marke oder Link"
            className="h-full min-w-0 flex-1 bg-transparent text-[1.1875rem] text-label outline-none placeholder:text-faint"
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
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="press sheen brand-gradient flex h-[4.35rem] w-full items-center justify-center gap-3 rounded-full text-[1.1875rem] font-semibold text-white shadow-[0_18px_36px_-20px_rgba(6,63,46,0.75)]"
        >
          <Camera className="h-6 w-6" strokeWidth={2.4} />
          Scannen
        </button>
      </motion.div>

      {scanNotice && (
        <motion.div
          variants={rise}
          className="flex items-center gap-2 rounded-[1rem] bg-accent-soft px-3 py-2 text-[0.9375rem] font-medium text-accent-ink"
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
          {hasNoResults && !showAdd && (
            <EmptyState
              title="Kein Produkt gefunden"
              description={`Für "${query}" gibt es noch keinen Eintrag.`}
              action={
                <button
                  onClick={handleResearch}
                  disabled={researching}
                  className="press inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-5 text-[1.0625rem] font-semibold text-white disabled:opacity-70"
                >
                  {researching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  Finden & anlegen
                </button>
              }
            />
          )}
          {hasNoResults && showAdd && <AddProductForm initialName={query} ownIntent={ownIntent} />}
        </motion.section>
      )}

      {idle && (
        <>
          <motion.section variants={rise} className="card-elevated relative overflow-hidden p-5">
            <div aria-hidden className="absolute inset-0 text-accent">
              <WaveLines opacity={0.08} />
            </div>
            <div className="relative flex items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-border">
                <span className="font-display text-[2.25rem] font-semibold leading-none">W</span>
              </span>
              <div>
                <h2 className="text-[1.3125rem] font-bold tracking-tight text-accent">
                  Wudly Signal
                </h2>
                <p className="mt-1 text-[1rem] leading-snug text-muted-foreground">
                  Echte Besitzer. Nach Nutzung. Keine Sterne-Show.
                </p>
              </div>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-2">
              {[
                { icon: Users, label: 'Echte Besitzer' },
                { icon: CalendarDays, label: 'Nach Nutzung' },
                { icon: Sparkles, label: 'Keine Sterne-Show' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-label shadow-[var(--shadow-xs)] ring-1 ring-border"
                  >
                    <Icon className="h-4 w-4 text-accent" strokeWidth={2.2} />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </motion.section>

          {featured.length > 0 && (
            <motion.section variants={rise} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[1.35rem] font-bold tracking-tight text-label">
                  Zuletzt geprüft
                </h2>
                <Link
                  href="/rankings"
                  className="tap-dim flex items-center text-[0.9375rem] text-muted-foreground"
                >
                  Alle anzeigen
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </div>
              <div className="space-y-3">
                {featured.slice(0, 2).map((product) => (
                  <RecentProduct key={product.id} product={product} />
                ))}
              </div>
            </motion.section>
          )}

          {categories.length > 0 && (
            <motion.section variants={rise} className="space-y-3">
              <h2 className="px-1 text-[1.35rem] font-bold tracking-tight text-label">
                Beliebte Kategorien
              </h2>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {categories.slice(0, 8).map((category) => (
                  <Link
                    key={category.id}
                    href={`/rankings?cat=${category.slug}`}
                    className="press inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[0.9375rem] font-medium text-label shadow-[var(--shadow-card)] ring-1 ring-border"
                  >
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full text-accent"
                      style={{ backgroundImage: categoryTile(category.slug) }}
                    >
                      <PackageCheck className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    {category.name}
                  </Link>
                ))}
              </div>
            </motion.section>
          )}

          <motion.section variants={rise} className="card p-5">
            <div className="grid gap-4">
              {[
                ['1', 'Scannen oder suchen'],
                ['2', 'Signal sehen'],
                ['3', 'Entscheiden'],
              ].map(([number, label]) => (
                <div key={number} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[0.875rem] font-bold text-white">
                    {number}
                  </span>
                  <span className="text-[1.0625rem] font-semibold text-label">{label}</span>
                </div>
              ))}
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}
