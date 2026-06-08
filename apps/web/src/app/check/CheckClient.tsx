'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Barcode,
  Camera,
  ChevronRight,
  ImagePlus,
  Link2,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CategoryDto,
  ProductSummaryDto,
  IdentifiedProductDto,
  RegretCheckDto,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ProductList } from '@/components/ProductList';
import { EmptyState, Skeleton } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { categoryTile } from '@/lib/categories';
import { AddProductForm } from './AddProductForm';
import { CameraScanner } from './CameraScanner';
import { HouseholdSwipeDeck } from './HouseholdSwipeDeck';

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
  const router = useRouter();
  const ownIntent = searchParams.get('own') === '1';
  const scanIntent = searchParams.get('scan') === '1';

  // Deep-link / sitelinks search box (Schema.org SearchAction) lands here as ?q=.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [results, setResults] = useState<ProductSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [shopUrl, setShopUrl] = useState('');
  const [regretResult, setRegretResult] = useState<RegretCheckDto | null>(null);
  const [regretLoading, setRegretLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopInputRef = useRef<HTMLInputElement | null>(null);

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

  const hasNoResults = results !== null && results.length === 0 && !loading;
  const idle = query.trim().length === 0;

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
      setScanNotice('Barcode erkannt …');
      try {
        const res = await api.products.resolveEan(code, { cache: 'no-store' });
        if (res.product) {
          router.push(`/products/${res.product.id}`);
          return;
        }
        if (res.suggestion) {
          setScanNotice(`Barcode erkannt: ${res.suggestion.title}`);
          setQuery(res.suggestion.title);
          void runSearch(res.suggestion.title);
          return;
        }
      } catch {
        // fall through to a raw search on the code
      }
      setScanNotice(`Barcode erkannt: ${code}`);
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
      setScanNotice(`Per Foto erkannt: ${label} — wird gespeichert …`);
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
        // fall through to a normal search
      }
      setScanNotice(`Erkannt: ${label}`);
      setQuery(result.query);
      void runSearch(result.query);
    },
    [router, runSearch],
  );

  return (
    <div className="animate-fade space-y-5 pt-2">
      <CameraScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetected}
        onIdentified={handleIdentified}
      />

      <LargeTitle
        title={ownIntent ? 'Dein Produkt' : 'Prüfen'}
        subtitle={
          ownIntent
            ? 'Finde dein Produkt und teile deine Erfahrung.'
            : 'Suche, scanne oder prüfe einen Kauf vor dem Bezahlen.'
        }
      />

      <div className="flex gap-2.5">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-[0.95rem] bg-fill-2 px-3.5">
          <Search
            className="h-[1.15rem] w-[1.15rem] shrink-0 text-faint"
            strokeWidth={2.2}
            aria-hidden
          />
          <input
            autoFocus={!scanIntent && !ownIntent}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowAdd(false);
              setScanNotice(null);
            }}
            placeholder="Produkt, Marke oder EAN"
            className="h-full flex-1 bg-transparent text-[1.0625rem] text-label outline-none placeholder:text-faint"
            inputMode="search"
            aria-label="Produktsuche"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setScanNotice(null);
              }}
              className="tap-dim grid h-5 w-5 shrink-0 place-items-center rounded-full bg-faint/70 text-white"
              aria-label="Leeren"
            >
              <X className="h-3 w-3" strokeWidth={3} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="press grid h-12 w-12 shrink-0 place-items-center rounded-[0.95rem] bg-ink text-white shadow-[var(--shadow-pop)]"
          aria-label="Kamera-Scan starten"
        >
          <Camera className="h-[1.375rem] w-[1.375rem]" strokeWidth={2.3} />
        </button>
      </div>

      {idle && (
        <section className="relative overflow-hidden rounded-[1.35rem] bg-ink p-4 text-white shadow-[var(--shadow-pop)] ring-1 ring-black/5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(10,116,255,0.46),transparent_36%),radial-gradient(circle_at_100%_0%,rgba(47,159,86,0.28),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_50%)]"
          />
          <div className="relative">
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] bg-white text-ink shadow-sm">
                <Camera className="h-6 w-6" strokeWidth={2.3} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.125rem] font-bold leading-tight">Scanner Studio</h2>
                <p className="mt-1 text-[0.8125rem] leading-snug text-white/68">
                  Barcode lesen, Produkt fotografieren oder direkt vor dem Kauf prüfen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="press flex h-11 shrink-0 items-center justify-center rounded-[0.85rem] bg-white px-4 text-[0.9375rem] font-semibold text-ink"
              >
                Start
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: Barcode, label: 'Barcode', text: 'EAN/UPC' },
                { icon: ImagePlus, label: 'Foto', text: 'mit Bild' },
                { icon: Link2, label: 'Shop', text: 'Regret' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.label === 'Shop') {
                        shopInputRef.current?.focus();
                      } else {
                        setScannerOpen(true);
                      }
                    }}
                    className="press rounded-[0.95rem] bg-white/10 px-2 py-3 text-left ring-1 ring-white/12"
                  >
                    <Icon className="h-5 w-5 text-white" strokeWidth={2.3} aria-hidden />
                    <span className="mt-2 block text-[0.8125rem] font-semibold leading-tight">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/48">
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {scanNotice && (
        <div className="flex items-center gap-2 rounded-[0.85rem] bg-accent-soft px-3 py-2 text-[0.875rem] font-medium text-accent-ink">
          <ShieldCheck className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.3} />
          <span>{scanNotice}</span>
        </div>
      )}

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
          description={`Für „${query}" gibt es noch keinen Eintrag. Lass Wudly im Web recherchieren und es automatisch anlegen.`}
          action={
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleResearch}
                disabled={researching}
                className="press inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-5 text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-70"
              >
                {researching ? (
                  <>
                    <Loader2 className="h-[1.15rem] w-[1.15rem] animate-spin" strokeWidth={2.4} />
                    Recherchiere im Web …
                  </>
                ) : (
                  <>
                    <Sparkles className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.4} />
                    Finden &amp; anlegen
                  </>
                )}
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="tap-dim text-[0.9375rem] font-medium text-muted-foreground"
              >
                Stattdessen manuell anlegen
              </button>
            </div>
          }
        />
      )}

      {hasNoResults && showAdd && <AddProductForm initialName={query} ownIntent={ownIntent} />}

      {/* Idle state — browse, never an empty void */}
      {idle && (
        <>
          <section className="card-elevated overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Link2 className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.3} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.125rem] font-bold tracking-tight text-label">
                    Vor dem Kauf prüfen
                  </h2>
                  <p className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
                    Shop-Link einfügen, Signal sehen, dann in Ruhe entscheiden.
                  </p>
                </div>
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const value = shopUrl.trim();
                  if (!value || regretLoading) return;
                  navigator.vibrate?.(12);
                  setRegretLoading(true);
                  setRegretResult(null);
                  const isUrl = /^(https?:\/\/|www\.)/i.test(value) || value.includes('/');
                  try {
                    const res = await api.products.regretCheck(
                      isUrl ? { url: value } : { query: value },
                    );
                    setRegretResult(res);
                  } catch {
                    setRegretResult(null);
                  } finally {
                    setRegretLoading(false);
                  }
                }}
              >
                <input
                  ref={shopInputRef}
                  value={shopUrl}
                  onChange={(event) => {
                    setShopUrl(event.target.value);
                    setRegretResult(null);
                  }}
                  placeholder="Shop-Link oder Produktname"
                  inputMode="url"
                  className="h-11 min-w-0 flex-1 rounded-[0.85rem] bg-fill-2 px-3 text-[0.9375rem] text-label outline-none placeholder:text-faint"
                  aria-label="Shop-URL oder Produktname"
                />
                <button
                  type="submit"
                  disabled={regretLoading}
                  className="press flex h-11 items-center gap-1.5 rounded-[0.85rem] bg-accent px-4 text-[0.9375rem] font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-70"
                >
                  {regretLoading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
                  Prüfen
                </button>
              </form>
              {regretResult && (
                <div className="mt-3 rounded-[0.85rem] bg-surface-2 p-3 ring-1 ring-border">
                  {regretResult.rebuyProbability !== null ? (
                    <p className="text-[0.9375rem] leading-snug text-label">
                      <span className="font-semibold">
                        {regretResult.rebuyProbability}% würden wieder kaufen
                      </span>
                      {regretResult.topConcern
                        ? ` — häufigster Vorbehalt: ${regretResult.topConcern}.`
                        : '.'}
                    </p>
                  ) : (
                    <p className="text-[0.9375rem] leading-snug text-muted-foreground">
                      {regretResult.summary}
                    </p>
                  )}
                  {regretResult.productId && (
                    <Link
                      href={`/products/${regretResult.productId}`}
                      className="tap-dim mt-2 inline-block text-[0.875rem] font-medium text-accent"
                    >
                      Zum Produkt ansehen →
                    </Link>
                  )}
                  {regretResult.source === 'ai' && (
                    <p className="mt-1.5 text-[0.75rem] text-faint">
                      KI-Schätzung — noch keine eigenen Wudly-Daten.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {categories.length > 0 && (
            <section>
              <GroupLabel>Kategorien</GroupLabel>
              <div className="grid grid-cols-2 gap-2.5">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/rankings?cat=${c.slug}`}
                    className="card press flex min-h-[4.5rem] items-center gap-3 p-2.5"
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.75rem] text-accent ring-1 ring-black/[0.04]"
                      style={{ backgroundImage: categoryTile(c.slug) }}
                    >
                      <PackageCheck className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-tight text-label [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                      {c.name}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-label-3"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {featured.length > 0 && (
            <section>
              <div className="mb-2 flex items-end justify-between px-1">
                <p className="text-[1.0625rem] font-bold tracking-tight text-label">
                  Beliebt gerade
                </p>
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

          <HouseholdSwipeDeck products={featured} />
        </>
      )}
    </div>
  );
}
