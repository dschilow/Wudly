'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import type { PulseCompetitorSetDto, PulseProductMetricsDto } from '@wudly/shared';
import { Loader2, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { productThumbUrl } from '@/lib/product-media';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import { ConfidenceChip, TrendChip, scoreTone } from '@/components/pulse/atoms';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/states/States';

/**
 * Wettbewerb — per portfolio product: mapped competitors side by side with a
 * plain-language verdict (where the own product wins / loses), plus one-click
 * mapping of same-category suggestions.
 */
export default function PulseCompetitorsPage() {
  const { periodDays } = usePulse();
  const [sets, setSets] = useState<PulseCompetitorSetDto[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    api.pulse
      .competitors(periodDays, { cache: 'no-store' })
      .then(setSets)
      .catch(() => setError(true));
  }, [periodDays]);

  useEffect(load, [load]);

  const addCompetitor = async (watchId: string, productId: string) => {
    setBusy(`${watchId}:${productId}`);
    try {
      await api.pulse.addCompetitor(watchId, { competitorProductId: productId });
      load();
    } finally {
      setBusy(null);
    }
  };
  const removeCompetitor = async (competitorId: string) => {
    setBusy(competitorId);
    try {
      await api.pulse.removeCompetitor(competitorId);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (error)
    return (
      <ErrorState
        description="Wettbewerbsdaten konnten nicht geladen werden."
        action={
          <button
            type="button"
            onClick={load}
            className="rounded-full bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-foreground"
          >
            Erneut versuchen
          </button>
        }
      />
    );
  if (!sets) return <PageSkeleton />;

  return (
    <div className="animate-fade space-y-6">
      <header>
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
          Wettbewerb
        </h1>
        <p className="mt-1 text-[0.92rem] text-muted-foreground">
          Deine Produkte gegen ihre wichtigsten Konkurrenten — auf Basis echter Besitzerstimmen,
          nicht Marketing-Versprechen.
        </p>
      </header>

      {sets.length === 0 ? (
        <EmptyState
          title="Kein Portfolio"
          description="Füge zuerst unter „Produkte“ eigene Produkte hinzu — danach kannst du hier Wettbewerber zuordnen."
        />
      ) : (
        sets.map((set) => (
          <section key={set.watchId} className="card space-y-4 p-5">
            <CompetitorRow metrics={set.own} isOwn strengths={undefined} />
            {set.verdict && (
              <p className="rounded-[0.85rem] bg-fill px-4 py-3 text-[0.9rem] font-medium leading-relaxed text-label-2">
                {set.verdict}
              </p>
            )}

            {set.competitors.length > 0 && (
              <div className="divide-y divide-separator">
                {set.competitors.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <CompetitorRow metrics={entry.metrics} />
                      {(entry.strengths.length > 0 || entry.regretReasons.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 pl-[52px] text-[0.78rem] text-muted-foreground">
                          {entry.strengths.length > 0 && (
                            <span>
                              <span className="text-positive-ink">Stark:</span>{' '}
                              {entry.strengths.map((s) => s.label).join(', ')}
                            </span>
                          )}
                          {entry.regretReasons.length > 0 && (
                            <span>
                              <span className="text-regret-ink">Schwach:</span>{' '}
                              {entry.regretReasons.map((s) => s.label).join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeCompetitor(entry.id)}
                      disabled={busy === entry.id}
                      title="Zuordnung entfernen"
                      className="mt-1 rounded-full p-1.5 text-label-3 hover:bg-fill-2 hover:text-regret"
                    >
                      {busy === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {set.suggestions.length > 0 && (
              <div className="border-t border-separator pt-3">
                <div className="mb-2 text-[0.78rem] font-medium uppercase tracking-wide text-label-3">
                  Vorschläge aus derselben Kategorie
                </div>
                <div className="flex flex-wrap gap-2">
                  {set.suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy === `${set.watchId}:${s.id}`}
                      onClick={() => void addCompetitor(set.watchId, s.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-[0.83rem] font-medium text-label hover:bg-fill disabled:opacity-50"
                    >
                      {busy === `${set.watchId}:${s.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-accent" />
                      )}
                      {s.canonicalName}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {set.competitors.length === 0 && set.suggestions.length === 0 && (
              <p className="text-[0.85rem] text-muted-foreground">
                Für diese Kategorie gibt es im Katalog noch keine vergleichbaren Produkte mit
                Besitzerstimmen.
              </p>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function CompetitorRow({
  metrics,
  isOwn,
}: {
  metrics: PulseProductMetricsDto;
  isOwn?: boolean;
  strengths?: undefined;
}) {
  const p = metrics.product;
  return (
    <div className="flex items-center gap-3">
      <Image
        src={productThumbUrl(p)}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 shrink-0 rounded-[0.7rem] bg-surface-muted object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('truncate font-semibold text-label', isOwn && 'text-[1.02rem]')}>
            {p.canonicalName}
          </span>
          {isOwn && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-accent-ink">
              Dein Produkt
            </span>
          )}
          <ConfidenceChip confidence={metrics.confidence} />
        </div>
        <div className="text-[0.78rem] text-muted-foreground">
          {metrics.experienceCount} Erfahrungen · {metrics.longTermCount} Langzeit ·{' '}
          {metrics.verifiedShare} % verifiziert
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="text-center">
          <div className={cn('font-display text-[1.2rem] font-bold tnum', scoreTone(metrics.rebuyScore))}>
            {metrics.rebuyScore ?? '–'}
          </div>
          <div className="text-[0.65rem] uppercase tracking-wide text-label-3">Wiederkauf</div>
        </div>
        <div className="hidden text-center sm:block">
          <div className={cn('font-display text-[1.2rem] font-bold tnum', scoreTone(metrics.healthIndex))}>
            {metrics.healthIndex ?? '–'}
          </div>
          <div className="text-[0.65rem] uppercase tracking-wide text-label-3">Health</div>
        </div>
        <TrendChip delta={metrics.trend.delta} />
      </div>
    </div>
  );
}
