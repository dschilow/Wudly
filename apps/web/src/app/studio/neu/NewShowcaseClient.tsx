'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DISCLOSURE_META,
  DisclosureType,
  type ProductSummaryDto,
  type ProductTemplateDto,
} from '@wudly/shared';
import { ArrowLeft, Check, Layers, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DisclosureBadge } from '@/components/DisclosureBadge';
import { Thumb } from '@/components/Thumb';
import { PageSkeleton } from '@/components/states/States';

// Creators never pick WUDLY_NATIVE — that's reserved for neutral owner experiences.
const SELECTABLE_DISCLOSURES = (Object.values(DisclosureType) as DisclosureType[]).filter(
  (d) => d !== DisclosureType.WUDLY_NATIVE,
);

const inputCls =
  'w-full rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-[1.0625rem] leading-snug text-label outline-none ring-1 ring-border placeholder:text-faint focus:ring-2 focus:ring-accent';

export function NewShowcaseClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  // Product picker
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<ProductSummaryDto | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [disclosureType, setDisclosureType] = useState<DisclosureType>(
    DisclosureType.INDEPENDENT_TEST,
  );
  const [templates, setTemplates] = useState<ProductTemplateDto[]>([]);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/studio/neu');
      return;
    }
    api.showcase
      .myProfile({ cache: 'no-store' })
      .then((p) => setHasProfile(Boolean(p)))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, [user, loading, router]);

  // Debounced product search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2 || product) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      api.products
        .search(q, 8)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, product]);

  // When a product is chosen, load matching category templates.
  useEffect(() => {
    if (!product?.category?.slug) {
      setTemplates([]);
      setTemplateSlug(null);
      return;
    }
    api.showcase
      .templatesForCategory(product.category.slug)
      .then((t) => setTemplates(t))
      .catch(() => setTemplates([]));
  }, [product]);

  function selectProduct(p: ProductSummaryDto) {
    setProduct(p);
    setResults([]);
    setQuery('');
    if (!title.trim()) setTitle(p.canonicalName);
  }

  const canCreate = Boolean(product) && title.trim().length >= 2 && !creating;

  async function handleCreate() {
    if (!canCreate || !product) return;
    setCreating(true);
    try {
      const showcase = await api.showcase.create(product.id, {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        disclosureType,
        templateSlug: templateSlug ?? undefined,
      });
      toast.show('Showcase als Entwurf angelegt', 'success');
      router.push(`/studio/showcases/${showcase.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Anlegen fehlgeschlagen.';
      toast.show(msg, 'error');
    } finally {
      setCreating(false);
    }
  }

  if (loading || checking) return <PageSkeleton />;
  if (!user) return null;

  // Must have a professional profile first.
  if (!hasProfile) {
    return (
      <div className="animate-fade mx-auto max-w-md space-y-4 pt-2">
        <Link
          href="/studio"
          className="tap-dim inline-flex items-center gap-1.5 text-[0.9375rem] text-accent"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Studio
        </Link>
        <div className="card p-5 text-center">
          <p className="text-[1.0625rem] font-semibold text-label">Profi-Profil nötig</p>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">
            Lege zuerst ein professionelles Profil an, um Showcases zu veröffentlichen.
          </p>
          <Link href="/studio/profil" className="mt-4 inline-block">
            <Button>Profil anlegen</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade mx-auto max-w-md space-y-5 pb-10 pt-1">
      <Link
        href="/studio"
        className="tap-dim inline-flex items-center gap-1.5 text-[0.9375rem] text-accent"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Studio
      </Link>

      <div className="px-1">
        <h1 className="text-[1.625rem] font-bold tracking-tight text-label">Neues Showcase</h1>
        <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
          Wähle ein Produkt und lege los — du baust die Inhalte danach im Editor.
        </p>
      </div>

      {/* 1 · Product */}
      <div>
        <p className="mb-1.5 px-1 text-[0.8125rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
          1 · Produkt
        </p>
        {product ? (
          <div className="card flex items-center gap-3 p-3">
            <Thumb product={product} className="h-12 w-12" rounded="rounded-[0.7rem]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-semibold text-label">
                {product.canonicalName}
              </p>
              <p className="truncate text-[0.8125rem] text-muted-foreground">
                {product.brand ?? product.category?.name ?? 'Produkt'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProduct(null)}
              className="tap-dim grid h-8 w-8 place-items-center rounded-full bg-fill-2 text-muted-foreground"
              aria-label="Produkt entfernen"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-faint"
              strokeWidth={2.2}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Produkt suchen…"
              className={cn(inputCls, 'pl-10')}
            />
            {(results.length > 0 || searching) && (
              <div className="mt-2 overflow-hidden rounded-[var(--radius-lg)] bg-surface ring-1 ring-border">
                {searching && results.length === 0 ? (
                  <p className="px-4 py-3 text-[0.9375rem] text-muted-foreground">Suche…</p>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectProduct(r)}
                      className={cn(
                        'tap flex w-full items-center gap-3 px-3 py-2.5 text-left',
                        i < results.length - 1 && 'hairline',
                      )}
                      style={{ ['--hairline-inset' as string]: '0.75rem' }}
                    >
                      <Thumb product={r} className="h-9 w-9" rounded="rounded-[0.55rem]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] text-label">
                          {r.canonicalName}
                        </span>
                        {r.brand && (
                          <span className="block truncate text-[0.75rem] text-muted-foreground">
                            {r.brand}
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2 · Title + subtitle */}
      <div className="space-y-3">
        <p className="px-1 text-[0.8125rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
          2 · Titel
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Titel des Showcases"
          className={inputCls}
        />
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          maxLength={200}
          placeholder="Untertitel (optional)"
          className={inputCls}
        />
      </div>

      {/* 3 · Disclosure — mandatory */}
      <div>
        <p className="mb-1.5 px-1 text-[0.8125rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
          3 · Transparenz (Pflicht)
        </p>
        <div className="space-y-2">
          {SELECTABLE_DISCLOSURES.map((d) => {
            const meta = DISCLOSURE_META[d];
            const active = disclosureType === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDisclosureType(d)}
                className={cn(
                  'press flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3.5 py-3 text-left ring-1 transition-colors',
                  active ? 'bg-accent-soft ring-accent' : 'bg-surface ring-border',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <DisclosureBadge type={d} size="sm" />
                  </span>
                  <span className="mt-1 block text-[0.8125rem] leading-snug text-muted-foreground">
                    {meta?.hint}
                  </span>
                </span>
                {active && <Check className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.6} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 · Template (optional) */}
      {templates.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[0.8125rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
            4 · Vorlage (optional)
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setTemplateSlug(null)}
              className={cn(
                'press flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3.5 py-3 text-left ring-1 transition-colors',
                templateSlug === null ? 'bg-accent-soft ring-accent' : 'bg-surface ring-border',
              )}
            >
              <span className="flex-1 text-[0.9375rem] font-medium text-label">
                Leer starten
              </span>
              {templateSlug === null && <Check className="h-5 w-5 text-accent" strokeWidth={2.6} />}
            </button>
            {templates.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setTemplateSlug(t.slug)}
                className={cn(
                  'press flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3.5 py-3 text-left ring-1 transition-colors',
                  templateSlug === t.slug ? 'bg-accent-soft ring-accent' : 'bg-surface ring-border',
                )}
              >
                <Layers className="h-[1.1rem] w-[1.1rem] shrink-0 text-accent" strokeWidth={2.2} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium text-label">{t.name}</span>
                  {t.description && (
                    <span className="block truncate text-[0.8125rem] text-muted-foreground">
                      {t.description}
                    </span>
                  )}
                  <span className="text-[0.75rem] text-faint">{t.blocks.length} Blöcke</span>
                </span>
                {templateSlug === t.slug && (
                  <Check className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.6} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button fullWidth size="lg" onClick={handleCreate} loading={creating} disabled={!canCreate}>
        Showcase anlegen
      </Button>
    </div>
  );
}
