'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ExternalRatingKind,
  type CategoryDto,
  type CreateCuratedProductInput,
  type ProductCurationDraftDto,
  type ProductCurationResearchDto,
  type ProductCurationWebResultDto,
  type ProductSummaryDto,
} from '@wudly/shared';
import { Loader2, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { ProductList } from '@/components/ProductList';
import { useToast } from '@/components/ui/Toast';

const UiButton = Button as any;
const UiCard = Card as any;
const UiPill = Pill as any;

const inputCls =
  'w-full rounded-[0.7rem] bg-surface px-3 py-2 text-[0.9375rem] leading-snug text-label outline-none ring-1 ring-border placeholder:text-faint focus:ring-2 focus:ring-accent';
const textareaCls = inputCls + ' min-h-24 resize-y';

interface SpecRow {
  id: string;
  label: string;
  value: string;
}

interface RatingRow {
  id: string;
  source: string;
  sourceLabel: string;
  url: string;
  kind: ExternalRatingKind;
  value: string;
  maxValue: string;
  count: string;
  note: string;
}

interface ThemeRow {
  id: string;
  label: string;
  sourceUrls: string;
}

interface FormState {
  canonicalName: string;
  brand: string;
  categorySlug: string;
  description: string;
  imageUrl: string;
  productUrl: string;
  ean: string;
  specs: SpecRow[];
  ratings: RatingRow[];
  consensusSummary: string;
  positiveThemes: ThemeRow[];
  negativeThemes: ThemeRow[];
  sourceUrls: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const emptySpec = (): SpecRow => ({ id: uid(), label: '', value: '' });
const emptyTheme = (): ThemeRow => ({ id: uid(), label: '', sourceUrls: '' });
const emptyRating = (): RatingRow => ({
  id: uid(),
  source: '',
  sourceLabel: '',
  url: '',
  kind: ExternalRatingKind.STARS,
  value: '',
  maxValue: '5',
  count: '',
  note: '',
});

const emptyForm = (): FormState => ({
  canonicalName: '',
  brand: '',
  categorySlug: '',
  description: '',
  imageUrl: '',
  productUrl: '',
  ean: '',
  specs: [emptySpec()],
  ratings: [emptyRating()],
  consensusSummary: '',
  positiveThemes: [emptyTheme()],
  negativeThemes: [emptyTheme()],
  sourceUrls: '',
});

function parseNumber(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

function splitUrls(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const first = host.split('.')[0] ?? host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return 'Quelle';
  }
}

function sourceKey(url: string, fallback: string): string {
  const raw = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').split('.')[0] ?? fallback;
    } catch {
      return fallback;
    }
  })();
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'quelle'
  );
}

function applyDraftToForm(form: FormState, draft: ProductCurationDraftDto): FormState {
  return {
    ...form,
    canonicalName: draft.title || form.canonicalName,
    brand: draft.brand ?? form.brand,
    ean: draft.ean ?? form.ean,
    imageUrl: draft.image ?? form.imageUrl,
    description: draft.description ?? form.description,
    specs: draft.specs.length
      ? draft.specs.map((spec) => ({ id: uid(), label: spec.label, value: spec.value }))
      : form.specs,
    sourceUrls: [form.sourceUrls, draft.source]
      .filter((value) => value.startsWith('http'))
      .join('\n'),
  };
}

function SourceList({
  title,
  sources,
  actionLabel,
  onUse,
}: {
  title: string;
  sources: ProductCurationWebResultDto[];
  actionLabel: string;
  onUse: (source: ProductCurationWebResultDto) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        {sources.map((source, i) => (
          <div
            key={source.url}
            className={i < sources.length - 1 ? 'hairline px-4 py-3' : 'px-4 py-3'}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tap-dim line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-label"
                >
                  {source.title || source.url}
                </a>
                {(source.description || source.snippets[0]) && (
                  <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground">
                    {source.description || source.snippets[0]}
                  </p>
                )}
                <p className="mono-data mt-1 truncate text-[0.625rem] uppercase tracking-[0.12em] text-faint">
                  {source.url}
                </p>
              </div>
              <UiButton size="sm" variant="gray" onClick={() => onUse(source)}>
                {actionLabel}
              </UiButton>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductCurationAdmin(): any {
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [research, setResearch] = useState<ProductCurationResearchDto | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<ProductSummaryDto[] | null>(null);
  const [created, setCreated] = useState<ProductSummaryDto | null>(null);

  useEffect(() => {
    api.categories
      .list({ cache: 'no-store' })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const runResearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setCreated(null);
    try {
      const result = await api.admin.curationResearch(q, { cache: 'no-store' });
      setResearch(result);
      setForm((current) => ({
        ...current,
        canonicalName: current.canonicalName || q,
        imageUrl: current.imageUrl || result.imageUrl || '',
      }));
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Recherche fehlgeschlagen.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestion = async (suggestion: ProductCurationResearchDto['market'][number]) => {
    setDraftLoading(suggestion.ean ?? suggestion.title);
    setCreated(null);
    try {
      if (suggestion.ean) {
        const draft = await api.admin.curationDraft(suggestion.ean, { cache: 'no-store' });
        if (draft) {
          setForm((current) => applyDraftToForm(current, draft));
          show(`EAN-Daten geladen (${draft.source})`, 'success');
          return;
        }
      }
      setForm((current) => ({
        ...current,
        canonicalName: suggestion.title,
        brand: suggestion.brand ?? current.brand,
        ean: suggestion.ean ?? current.ean,
        imageUrl: suggestion.image ?? current.imageUrl,
      }));
    } catch (err) {
      show(
        err instanceof ApiError ? err.displayMessage : 'EAN-Daten konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setDraftLoading(null);
    }
  };

  const addProductSource = (source: ProductCurationWebResultDto) => {
    setForm((current) => ({
      ...current,
      productUrl: current.productUrl || source.url,
      sourceUrls: [current.sourceUrls, source.url].filter(Boolean).join('\n'),
    }));
  };

  const addRatingSource = (source: ProductCurationWebResultDto) => {
    setForm((current) => ({
      ...current,
      ratings: [
        ...current.ratings,
        {
          ...emptyRating(),
          source: sourceKey(source.url, source.title),
          sourceLabel: hostLabel(source.url),
          url: source.url,
        },
      ],
      sourceUrls: [current.sourceUrls, source.url].filter(Boolean).join('\n'),
    }));
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSpec = (id: string, key: keyof SpecRow, value: string) => {
    setForm((current) => ({
      ...current,
      specs: current.specs.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    }));
  };

  const updateRating = (id: string, key: keyof RatingRow, value: string) => {
    setForm((current) => ({
      ...current,
      ratings: current.ratings.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    }));
  };

  const updateTheme = (
    kind: 'positiveThemes' | 'negativeThemes',
    id: string,
    key: keyof ThemeRow,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [kind]: current[kind].map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    }));
  };

  const payload = useMemo<CreateCuratedProductInput | null>(() => {
    if (form.canonicalName.trim().length < 2) return null;
    const ratings = form.ratings
      .filter(
        (rating) =>
          rating.source.trim() &&
          rating.sourceLabel.trim() &&
          rating.url.trim() &&
          rating.value.trim(),
      )
      .map((rating) => ({
        source: rating.source.trim().toLowerCase(),
        sourceLabel: rating.sourceLabel.trim(),
        url: rating.url.trim(),
        kind: rating.kind,
        value: parseNumber(rating.value),
        maxValue:
          rating.kind === ExternalRatingKind.STARS ? parseNumber(rating.maxValue || '5') : 100,
        count: rating.count.trim() ? Math.round(parseNumber(rating.count)) : null,
        note: rating.note.trim() || null,
      }));

    if (
      ratings.some((rating) => !Number.isFinite(rating.value) || !Number.isFinite(rating.maxValue))
    ) {
      return null;
    }

    return {
      canonicalName: form.canonicalName.trim(),
      brand: form.brand.trim() || undefined,
      categorySlug: form.categorySlug || undefined,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      productUrl: form.productUrl.trim() || undefined,
      ean: form.ean.trim() || undefined,
      specs: form.specs
        .filter((spec) => spec.label.trim() && spec.value.trim())
        .map((spec) => ({ label: spec.label.trim(), value: spec.value.trim() })),
      ratings,
      consensusSummary: form.consensusSummary.trim() || undefined,
      positiveThemes: form.positiveThemes
        .filter((theme) => theme.label.trim())
        .map((theme) => ({ label: theme.label.trim(), sourceUrls: splitUrls(theme.sourceUrls) })),
      negativeThemes: form.negativeThemes
        .filter((theme) => theme.label.trim())
        .map((theme) => ({ label: theme.label.trim(), sourceUrls: splitUrls(theme.sourceUrls) })),
      sourceUrls: splitUrls(form.sourceUrls),
      forceCreate: false,
    };
  }, [form]);

  const save = async (forceCreate = false) => {
    if (!payload) {
      show('Bitte pruefe Name und Bewertungswerte.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.admin.createCuratedProduct({ ...payload, forceCreate });
      if (result.created) {
        setCreated(result.product);
        setDuplicates(null);
        setForm(emptyForm());
        show('Produkt kuratiert angelegt.', 'success');
      } else {
        setDuplicates(result.candidates.map((candidate) => candidate.product));
        show('Moegliche Duplikate gefunden.', 'info');
      }
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="px-1">
        <h2 className="text-[1.3rem] font-bold tracking-tight text-label">
          Katalogpflege ohne KI-Kosten
        </h2>
        <p className="text-[0.875rem] text-muted-foreground">
          Suche Quellen, uebernimm EAN-Daten und speichere Produktdaten, Bewertungen und
          Pro/Contra-Themen manuell kuratiert.
        </p>
      </div>

      <UiCard className="space-y-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runResearch();
              }}
              placeholder="Produkt oder Modell recherchieren"
              className={inputCls + ' pl-9'}
            />
          </div>
          <UiButton loading={loading} onClick={() => void runResearch()}>
            Recherchieren
          </UiButton>
        </div>
        {research && (
          <div className="flex flex-wrap gap-2">
            <UiPill tone={research.searchEnabled ? 'positive' : 'unsure'}>
              Websuche {research.searchEnabled ? 'aktiv' : 'ohne Brave-Key'}
            </UiPill>
            <UiPill tone="neutral">{research.catalog.length} Katalogtreffer</UiPill>
            <UiPill tone="neutral">{research.market.length} EAN-Vorschlaege</UiPill>
          </div>
        )}
      </UiCard>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {research?.catalog.length ? (
            <section className="space-y-2">
              <p className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Schon im Katalog
              </p>
              <ProductList products={research.catalog} />
            </section>
          ) : null}

          {research?.market.length ? (
            <section className="space-y-2">
              <p className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                EAN-/Marktquellen
              </p>
              <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[0_0_0_1px_var(--color-border)]">
                {research.market.map((suggestion, i) => {
                  const busy = draftLoading === (suggestion.ean ?? suggestion.title);
                  return (
                    <button
                      key={suggestion.ean ?? suggestion.title}
                      type="button"
                      onClick={() => void loadSuggestion(suggestion)}
                      className={
                        'tap flex w-full items-center gap-3 px-4 py-3 text-left ' +
                        (i < research.market.length - 1 ? 'hairline' : '')
                      }
                    >
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[0.7rem] bg-surface-muted text-faint">
                        {suggestion.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={suggestion.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[0.9375rem] font-semibold text-label">
                          {suggestion.title}
                        </span>
                        <span className="mono-data mt-0.5 block truncate text-[0.625rem] uppercase tracking-[0.12em] text-faint">
                          {suggestion.brand ?? 'Produkt'}
                          {suggestion.ean ? ` · EAN ${suggestion.ean}` : ''}
                        </span>
                      </span>
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : (
                        <Plus className="h-4 w-4 text-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {research?.imageUrl && (
            <UiCard className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={research.imageUrl}
                alt=""
                className="h-16 w-16 rounded-[0.7rem] object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-label">Bildvorschlag</p>
                <p className="truncate text-[0.8125rem] text-muted-foreground">
                  {research.imageUrl}
                </p>
              </div>
              <UiButton
                size="sm"
                variant="gray"
                onClick={() => setField('imageUrl', research.imageUrl ?? '')}
              >
                Nutzen
              </UiButton>
            </UiCard>
          )}

          {research && (
            <>
              <SourceList
                title="Produktdaten-Quellen"
                sources={research.productSources}
                actionLabel="Quelle"
                onUse={addProductSource}
              />
              <SourceList
                title="Bewertungs-Quellen"
                sources={research.ratingSources}
                actionLabel="Rating"
                onUse={addRatingSource}
              />
            </>
          )}
        </div>

        <UiCard className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.canonicalName}
              onChange={(e) => setField('canonicalName', e.target.value)}
              placeholder="Kanonischer Name"
              className={inputCls + ' sm:col-span-2'}
            />
            <input
              value={form.brand}
              onChange={(e) => setField('brand', e.target.value)}
              placeholder="Marke"
              className={inputCls}
            />
            <select
              value={form.categorySlug}
              onChange={(e) => setField('categorySlug', e.target.value)}
              className={inputCls}
            >
              <option value="">Kategorie optional</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              value={form.ean}
              onChange={(e) => setField('ean', e.target.value)}
              placeholder="EAN/GTIN"
              inputMode="numeric"
              className={inputCls}
            />
            <input
              value={form.productUrl}
              onChange={(e) => setField('productUrl', e.target.value)}
              placeholder="Produktquelle https://..."
              inputMode="url"
              className={inputCls}
            />
            <input
              value={form.imageUrl}
              onChange={(e) => setField('imageUrl', e.target.value)}
              placeholder="Bild-URL https://..."
              inputMode="url"
              className={inputCls + ' sm:col-span-2'}
            />
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Kurzbeschreibung / Einordnung"
              className={textareaCls + ' sm:col-span-2'}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-label">Eigenschaften</h3>
              <UiButton
                size="sm"
                variant="gray"
                onClick={() =>
                  setForm((current) => ({ ...current, specs: [...current.specs, emptySpec()] }))
                }
              >
                +
              </UiButton>
            </div>
            {form.specs.map((spec) => (
              <div key={spec.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  value={spec.label}
                  onChange={(e) => updateSpec(spec.id, 'label', e.target.value)}
                  placeholder="Label"
                  className={inputCls}
                />
                <input
                  value={spec.value}
                  onChange={(e) => updateSpec(spec.id, 'value', e.target.value)}
                  placeholder="Wert"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      specs: current.specs.filter((row) => row.id !== spec.id),
                    }))
                  }
                  className="tap grid h-10 w-10 place-items-center rounded-[0.7rem] text-regret"
                  aria-label="Eigenschaft entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-label">Bewertungen anderswo</h3>
              <UiButton
                size="sm"
                variant="gray"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    ratings: [...current.ratings, emptyRating()],
                  }))
                }
              >
                +
              </UiButton>
            </div>
            {form.ratings.map((rating) => (
              <div
                key={rating.id}
                className="grid gap-2 rounded-[0.7rem] bg-fill-1 p-2 sm:grid-cols-2"
              >
                <input
                  value={rating.source}
                  onChange={(e) => updateRating(rating.id, 'source', e.target.value)}
                  placeholder="key z.B. amazon"
                  className={inputCls}
                />
                <input
                  value={rating.sourceLabel}
                  onChange={(e) => updateRating(rating.id, 'sourceLabel', e.target.value)}
                  placeholder="Name"
                  className={inputCls}
                />
                <input
                  value={rating.url}
                  onChange={(e) => updateRating(rating.id, 'url', e.target.value)}
                  placeholder="Quelle https://..."
                  className={inputCls + ' sm:col-span-2'}
                />
                <select
                  value={rating.kind}
                  onChange={(e) => updateRating(rating.id, 'kind', e.target.value)}
                  className={inputCls}
                >
                  <option value={ExternalRatingKind.STARS}>Sterne</option>
                  <option value={ExternalRatingKind.PERCENT}>Prozent</option>
                  <option value={ExternalRatingKind.GRADE_DE}>Schulnote</option>
                </select>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={rating.value}
                    onChange={(e) => updateRating(rating.id, 'value', e.target.value)}
                    placeholder="Wert"
                    inputMode="decimal"
                    className={inputCls}
                  />
                  <input
                    value={rating.maxValue}
                    onChange={(e) => updateRating(rating.id, 'maxValue', e.target.value)}
                    placeholder="Max"
                    inputMode="decimal"
                    disabled={rating.kind !== ExternalRatingKind.STARS}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        ratings: current.ratings.filter((row) => row.id !== rating.id),
                      }))
                    }
                    className="tap grid h-10 w-10 place-items-center rounded-[0.7rem] text-regret"
                    aria-label="Bewertung entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={rating.count}
                  onChange={(e) => updateRating(rating.id, 'count', e.target.value)}
                  placeholder="Anzahl"
                  inputMode="numeric"
                  className={inputCls}
                />
                <input
                  value={rating.note}
                  onChange={(e) => updateRating(rating.id, 'note', e.target.value)}
                  placeholder="Hinweis optional"
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-label">Pro / Contra</h3>
            <textarea
              value={form.consensusSummary}
              onChange={(e) => setField('consensusSummary', e.target.value)}
              placeholder="Kurzer externer Konsens"
              className={textareaCls}
            />
            {(['positiveThemes', 'negativeThemes'] as const).map((kind) => (
              <div key={kind} className="space-y-2 rounded-[0.7rem] bg-fill-1 p-2">
                <div className="flex items-center justify-between">
                  <UiPill tone={kind === 'positiveThemes' ? 'positive' : 'negative'}>
                    {kind === 'positiveThemes' ? 'Pro' : 'Contra'}
                  </UiPill>
                  <UiButton
                    size="sm"
                    variant="gray"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        [kind]: [...current[kind], emptyTheme()],
                      }))
                    }
                  >
                    +
                  </UiButton>
                </div>
                {form[kind].map((theme) => (
                  <div key={theme.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={theme.label}
                      onChange={(e) => updateTheme(kind, theme.id, 'label', e.target.value)}
                      placeholder="Thema"
                      className={inputCls}
                    />
                    <input
                      value={theme.sourceUrls}
                      onChange={(e) => updateTheme(kind, theme.id, 'sourceUrls', e.target.value)}
                      placeholder="Quellen URLs"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          [kind]: current[kind].filter((row) => row.id !== theme.id),
                        }))
                      }
                      className="tap grid h-10 w-10 place-items-center rounded-[0.7rem] text-regret"
                      aria-label="Thema entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            <textarea
              value={form.sourceUrls}
              onChange={(e) => setField('sourceUrls', e.target.value)}
              placeholder="Weitere Quellen, eine URL pro Zeile"
              className={textareaCls}
            />
          </div>

          {duplicates && duplicates.length > 0 && (
            <div className="space-y-2 rounded-[0.7rem] bg-unsure-soft p-3">
              <p className="font-semibold text-label">Moegliche Duplikate</p>
              <ProductList products={duplicates} />
              <UiButton fullWidth variant="danger" loading={saving} onClick={() => void save(true)}>
                Trotzdem neues Produkt anlegen
              </UiButton>
            </div>
          )}

          {created && (
            <div className="flex items-center justify-between rounded-[0.7rem] bg-positive-soft px-3 py-2">
              <span className="text-[0.9375rem] font-semibold text-positive-ink">
                Angelegt: {created.canonicalName}
              </span>
              <Link
                href={`/products/${created.id}`}
                className="text-[0.875rem] font-semibold text-positive-ink underline"
              >
                Oeffnen
              </Link>
            </div>
          )}

          <div className="flex gap-2">
            <UiButton
              variant="gray"
              onClick={() => {
                setForm(emptyForm());
                setDuplicates(null);
              }}
              className="flex-1"
            >
              Leeren
            </UiButton>
            <UiButton
              loading={saving}
              disabled={!payload}
              onClick={() => void save(false)}
              className="flex-1"
            >
              Produkt speichern
            </UiButton>
          </div>
        </UiCard>
      </div>
    </section>
  );
}
