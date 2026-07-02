'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  USAGE_DURATION_LABEL,
  USAGE_DURATION_OPTIONS,
  WOULD_BUY_AGAIN_LABEL,
  type PulseFeedbackPageDto,
  type PulseWorkspaceDto,
} from '@wudly/shared';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import { SectionCard } from '@/components/pulse/atoms';
import { EmptyState, PageSkeleton } from '@/components/states/States';

const PAGE_SIZE = 20;

/**
 * Kundenfeedback — anonymized long-term owner voices with honest filters and
 * an aggregated theme summary (existing snapshot AI, no extra AI spend).
 */
export default function PulseFeedbackPage() {
  const { periodDays } = usePulse();
  const [workspace, setWorkspace] = useState<PulseWorkspaceDto | null>(null);
  const [data, setData] = useState<PulseFeedbackPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [productId, setProductId] = useState('');
  const [rebuy, setRebuy] = useState('');
  const [duration, setDuration] = useState('');
  const [verified, setVerified] = useState(false);
  const [sentiment, setSentiment] = useState('');
  const [windowed, setWindowed] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.pulse
      .workspace(periodDays, { cache: 'no-store' })
      .then(setWorkspace)
      .catch(() => undefined);
  }, [periodDays]);

  const load = useCallback(() => {
    setLoading(true);
    api.pulse
      .feedback(
        {
          productId: productId || undefined,
          wouldBuyAgain: rebuy || undefined,
          usageDuration: duration || undefined,
          verified: verified ? '1' : undefined,
          sentiment: sentiment || undefined,
          days: windowed ? periodDays : undefined,
          q: q.trim() || undefined,
          take: PAGE_SIZE,
          skip: page * PAGE_SIZE,
        },
        { cache: 'no-store' },
      )
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [productId, rebuy, duration, verified, sentiment, windowed, q, page, periodDays]);

  useEffect(load, [load]);
  // Any filter change resets to page 1.
  useEffect(() => {
    setPage(0);
  }, [productId, rebuy, duration, verified, sentiment, windowed, q]);

  if (!data && loading) return <PageSkeleton />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="animate-fade space-y-5">
      <header>
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
          Kundenfeedback
        </h1>
        <p className="mt-1 text-[0.92rem] text-muted-foreground">
          Echte, anonymisierte Langzeit-Erfahrungen aus deinem Portfolio — filterbar nach dem, was
          Wudly wirklich weiß.
        </p>
      </header>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="flex min-w-52 flex-1 items-center gap-2 rounded-[0.75rem] bg-fill px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-label-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Volltext durchsuchen …"
            className="w-full bg-transparent text-[0.9rem] text-label outline-none placeholder:text-label-3"
          />
        </div>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={selectCls}>
          <option value="">Alle Produkte</option>
          {workspace?.products.map((p) => (
            <option key={p.product.id} value={p.product.id}>
              {p.product.canonicalName}
            </option>
          ))}
        </select>
        <select value={rebuy} onChange={(e) => setRebuy(e.target.value)} className={selectCls}>
          <option value="">Wiederkauf: alle</option>
          <option value="YES">Würde wieder kaufen</option>
          <option value="NO">Würde nicht wieder kaufen</option>
          <option value="UNSURE">Unsicher</option>
        </select>
        <select value={duration} onChange={(e) => setDuration(e.target.value)} className={selectCls}>
          <option value="">Besitzdauer: alle</option>
          {USAGE_DURATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} className={selectCls}>
          <option value="">Stimmung: alle</option>
          <option value="positive">Positiv</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negativ</option>
        </select>
        <FilterToggle active={verified} onClick={() => setVerified((v) => !v)}>
          Nur verifiziert
        </FilterToggle>
        <FilterToggle active={windowed} onClick={() => setWindowed((v) => !v)}>
          Letzte {periodDays} Tage
        </FilterToggle>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Feed */}
        <div className="space-y-3">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-label-3" />
            </div>
          )}
          {!loading && (!data || data.items.length === 0) && (
            <EmptyState
              title="Kein Feedback für diese Filter"
              description="Lockere die Filter oder erweitere den Zeitraum."
            />
          )}
          {!loading &&
            data?.items.map((item) => (
              <article key={item.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 text-[0.78rem]">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-semibold',
                      item.wouldBuyAgain === 'YES'
                        ? 'bg-positive-soft text-positive-ink'
                        : item.wouldBuyAgain === 'NO'
                          ? 'bg-regret-soft text-regret-ink'
                          : 'bg-unsure-soft text-unsure-ink',
                    )}
                  >
                    {WOULD_BUY_AGAIN_LABEL[item.wouldBuyAgain]}
                  </span>
                  <span className="text-muted-foreground">
                    {USAGE_DURATION_LABEL[item.usageDuration]}
                  </span>
                  {item.verificationStatus === 'VERIFIED' && (
                    <span className="font-medium text-accent-ink">verifizierter Käufer</span>
                  )}
                  {item.variantName && (
                    <span className="text-muted-foreground">Variante {item.variantName}</span>
                  )}
                  <Link
                    href={`/pulse/produkte/${item.productId}`}
                    className="ml-auto font-medium text-accent-ink hover:underline"
                  >
                    {item.productName}
                  </Link>
                </div>
                {item.freeText && (
                  <p className="mt-2 text-[0.92rem] leading-relaxed text-label">
                    „{item.freeText}“
                  </p>
                )}
                {item.wishKnownText && (
                  <p className="mt-1.5 text-[0.85rem] text-muted-foreground">
                    <span className="font-medium text-label-2">Hätte ich vorher gewusst:</span>{' '}
                    {item.wishKnownText}
                  </p>
                )}
                {item.insteadOfText && (
                  <p className="mt-1 text-[0.85rem] text-muted-foreground">
                    <span className="font-medium text-label-2">Hätte stattdessen gekauft:</span>{' '}
                    {item.insteadOfText}
                  </p>
                )}
                {item.aspects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.aspects.map((a) => (
                      <span
                        key={a.aspectKey}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[0.72rem] font-medium',
                          a.sentiment === 'POSITIVE'
                            ? 'bg-positive-soft text-positive-ink'
                            : a.sentiment === 'NEGATIVE'
                              ? 'bg-regret-soft text-regret-ink'
                              : 'bg-fill-2 text-muted-foreground',
                        )}
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}

          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-1 text-[0.85rem] text-muted-foreground">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full bg-fill-2 px-4 py-1.5 font-medium disabled:opacity-40"
              >
                ← Zurück
              </button>
              <span>
                Seite {page + 1} / {totalPages} · {data.total} Stimmen
              </span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full bg-fill-2 px-4 py-1.5 font-medium disabled:opacity-40"
              >
                Weiter →
              </button>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        {data && (
          <div className="space-y-4">
            <SectionCard title="Themen-Zusammenfassung" subtitle="Aggregiert über die aktuelle Auswahl.">
              <ThemeBlock label="Positiv" items={data.summary.positiveThemes.map((t) => `${t.label} (${t.count}×)`)} tone="positive" />
              <ThemeBlock label="Negativ" items={data.summary.negativeThemes.map((t) => `${t.label} (${t.count}×)`)} tone="negative" />
              {data.summary.newThemes.length > 0 && (
                <ThemeBlock label="Neu aufgetreten" items={data.summary.newThemes.map((t) => `${t.label} (${t.count}×)`)} tone="warning" />
              )}
            </SectionCard>
            {data.summary.wishes.length > 0 && (
              <SectionCard title="Häufigste Wünsche" subtitle="„Hätte ich vorher gewusst …“">
                <ul className="space-y-1.5 text-[0.85rem] text-label-2">
                  {data.summary.wishes.map((wish) => (
                    <li key={wish}>· {wish}</li>
                  ))}
                </ul>
              </SectionCard>
            )}
            {data.summary.aiHeadlines.length > 0 && (
              <SectionCard title="KI-Kurzfazit je Produkt" subtitle="Aus den bestehenden Wudly-Insights.">
                <ul className="space-y-2.5">
                  {data.summary.aiHeadlines.map((h) => (
                    <li key={h.productId} className="text-[0.85rem] leading-snug">
                      <span className="font-semibold text-label">{h.productName}:</span>{' '}
                      <span className="text-muted-foreground">„{h.headline}“</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const selectCls =
  'rounded-[0.75rem] border border-border bg-surface px-2.5 py-2 text-[0.83rem] text-label outline-none';

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-[0.8rem] font-medium',
        active ? 'bg-primary text-primary-foreground' : 'bg-fill-2 text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ThemeBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'positive' | 'negative' | 'warning';
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <div
        className={cn(
          'mb-1 text-[0.75rem] font-semibold uppercase tracking-wide',
          tone === 'positive'
            ? 'text-positive-ink'
            : tone === 'negative'
              ? 'text-regret-ink'
              : 'text-unsure-ink',
        )}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-fill-2 px-2.5 py-0.5 text-[0.78rem] text-label-2">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
