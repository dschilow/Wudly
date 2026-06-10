'use client';

import { useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import {
  ExternalRatingKind,
  formatExternalRating,
  formatRatingCount,
  type ExternalRatingDto,
  type ProductSummaryDto,
  type UpsertExternalRatingInput,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';

const inputCls =
  'w-full rounded-[0.7rem] bg-surface px-3 py-2 text-[0.9375rem] leading-snug text-label outline-none ring-1 ring-border placeholder:text-faint focus:ring-2 focus:ring-accent';

const KIND_OPTIONS: Array<{ value: ExternalRatingKind; label: string }> = [
  { value: ExternalRatingKind.STARS, label: 'Sterne (z. B. 4,5 / 5)' },
  { value: ExternalRatingKind.PERCENT, label: 'Prozent (0–100)' },
  { value: ExternalRatingKind.GRADE_DE, label: 'Schulnote (z. B. Warentest 2,1)' },
];

/** Common sources, one tap to prefill key + label. */
const SOURCE_PRESETS = [
  { source: 'amazon', label: 'Amazon' },
  { source: 'idealo', label: 'idealo' },
  { source: 'mediamarkt', label: 'MediaMarkt' },
  { source: 'otto', label: 'OTTO' },
  { source: 'warentest', label: 'Stiftung Warentest' },
];

interface FormState {
  source: string;
  sourceLabel: string;
  url: string;
  kind: ExternalRatingKind;
  value: string;
  maxValue: string;
  count: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  source: '',
  sourceLabel: '',
  url: '',
  kind: ExternalRatingKind.STARS,
  value: '',
  maxValue: '5',
  count: '',
  note: '',
};

/**
 * Admin editor for external rating facts ("Bewertungen anderswo"): pick a
 * product, then add/update per-source aggregate values with mandatory link.
 */
export function ExternalRatingsAdmin() {
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[]>([]);
  const [product, setProduct] = useState<ProductSummaryDto | null>(null);
  const [ratings, setRatings] = useState<ExternalRatingDto[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  // Debounced product search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.products
        .search(q, 6, { cache: 'no-store' })
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const selectProduct = (p: ProductSummaryDto) => {
    setProduct(p);
    setResults([]);
    setQuery('');
    setForm(EMPTY_FORM);
    api.admin
      .externalRatings(p.id, { cache: 'no-store' })
      .then(setRatings)
      .catch(() => setRatings([]));
  };

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const applyPreset = (preset: (typeof SOURCE_PRESETS)[number]) => {
    setForm((f) => ({ ...f, source: preset.source, sourceLabel: preset.label }));
  };

  const editRating = (r: ExternalRatingDto) => {
    setForm({
      source: r.source,
      sourceLabel: r.sourceLabel,
      url: r.url,
      kind: r.kind,
      value: String(r.value).replace('.', ','),
      maxValue: String(r.maxValue),
      count: r.count === null ? '' : String(r.count),
      note: r.note ?? '',
    });
  };

  const parseNum = (s: string): number => Number(s.trim().replace(',', '.'));

  const save = async () => {
    if (!product) return;
    const input: UpsertExternalRatingInput = {
      source: form.source.trim(),
      sourceLabel: form.sourceLabel.trim(),
      url: form.url.trim(),
      kind: form.kind,
      value: parseNum(form.value),
      maxValue: form.kind === 'STARS' ? parseNum(form.maxValue || '5') : 100,
      count: form.count.trim() === '' ? null : Math.round(parseNum(form.count)),
      note: form.note.trim() === '' ? null : form.note.trim(),
    };
    setBusy(true);
    try {
      const saved = await api.admin.upsertExternalRating(product.id, input);
      setRatings((prev) => {
        const rest = prev.filter((r) => r.source !== saved.source);
        return [...rest, saved].sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
      });
      setForm(EMPTY_FORM);
      show('Bewertung gespeichert ✓', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: ExternalRatingDto) => {
    setBusy(true);
    try {
      await api.admin.deleteExternalRating(r.id);
      setRatings((prev) => prev.filter((x) => x.id !== r.id));
      show('Bewertung entfernt', 'info');
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Löschen fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const canSave =
    form.source.trim().length >= 2 &&
    form.sourceLabel.trim().length >= 2 &&
    /^https?:\/\//.test(form.url.trim()) &&
    form.value.trim() !== '' &&
    Number.isFinite(parseNum(form.value));

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-[1.3rem] font-bold tracking-tight text-label">Bewertungen anderswo</h2>
        <p className="text-[0.875rem] text-muted-foreground">
          Aggregierte Fakten externer Plattformen (Durchschnitt + Anzahl + Quelle). Fließt nie ins
          Wudly Signal ein.
        </p>
      </div>

      {/* Product picker */}
      <Card className="space-y-2">
        {product ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-label">{product.canonicalName}</p>
              <p className="text-[0.8125rem] text-muted-foreground">
                {ratings.length} externe {ratings.length === 1 ? 'Quelle' : 'Quellen'}
              </p>
            </div>
            <Button size="sm" variant="gray" onClick={() => setProduct(null)}>
              Wechseln
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                strokeWidth={2.2}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Produkt suchen…"
                className={inputCls + ' pl-9'}
              />
            </div>
            {results.length > 0 && (
              <ul className="overflow-hidden rounded-[0.7rem] ring-1 ring-border">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectProduct(p)}
                      className="tap w-full px-3 py-2.5 text-left text-[0.9375rem] text-label hairline"
                    >
                      {p.canonicalName}
                      {p.brand && (
                        <span className="ml-2 text-[0.8125rem] text-muted-foreground">
                          {p.brand}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {product && (
        <>
          {/* Existing ratings */}
          {ratings.length > 0 && (
            <Card className="space-y-0 p-0">
              {ratings.map((r, i) => (
                <div
                  key={r.id}
                  className={
                    'flex items-center gap-2 px-4 py-3 ' + (i < ratings.length - 1 ? 'hairline' : '')
                  }
                >
                  <button
                    type="button"
                    onClick={() => editRating(r)}
                    className="tap-dim min-w-0 flex-1 text-left"
                  >
                    <p className="text-[0.9375rem] font-semibold text-label">
                      {r.sourceLabel}{' '}
                      <span className="font-normal text-muted-foreground">
                        · {formatExternalRating(r)}
                        {r.count !== null && ` · ${formatRatingCount(r.count)} Bew.`}
                      </span>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    disabled={busy}
                    className="tap-dim grid h-8 w-8 shrink-0 place-items-center rounded-full text-regret"
                    aria-label={`${r.sourceLabel} entfernen`}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.1} />
                  </button>
                </div>
              ))}
            </Card>
          )}

          {/* Upsert form */}
          <Card className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_PRESETS.map((p) => (
                <button key={p.source} type="button" onClick={() => applyPreset(p)} className="tap-dim">
                  <Pill tone={form.source === p.source ? 'accent' : 'neutral'}>{p.label}</Pill>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
                placeholder="Key (z. B. amazon)"
                className={inputCls}
              />
              <input
                value={form.sourceLabel}
                onChange={(e) => set('sourceLabel', e.target.value)}
                placeholder="Anzeigename"
                className={inputCls}
              />
            </div>
            <input
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="Quelle (https://…)"
              inputMode="url"
              className={inputCls}
            />
            <select
              value={form.kind}
              onChange={(e) => set('kind', e.target.value as ExternalRatingKind)}
              className={inputCls}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                placeholder={form.kind === 'GRADE_DE' ? 'Note (2,1)' : 'Wert'}
                inputMode="decimal"
                className={inputCls}
              />
              {form.kind === 'STARS' && (
                <input
                  value={form.maxValue}
                  onChange={(e) => set('maxValue', e.target.value)}
                  placeholder="Skala (5)"
                  inputMode="decimal"
                  className={inputCls}
                />
              )}
              <input
                value={form.count}
                onChange={(e) => set('count', e.target.value)}
                placeholder="Anzahl"
                inputMode="numeric"
                className={inputCls}
              />
            </div>
            <input
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Hinweis (z. B. Heft 5/2024) — optional"
              className={inputCls}
            />
            <Button fullWidth loading={busy} disabled={!canSave} onClick={save}>
              Speichern
            </Button>
          </Card>
        </>
      )}
    </section>
  );
}
