'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  USAGE_DURATION_LABEL,
  WOULD_BUY_AGAIN_LABEL,
  type PulseProduct360Dto,
  type PulseSignalDto,
} from '@wudly/shared';
import { ArrowLeft, BadgeCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '@/lib/api';
import { productThumbUrl } from '@/lib/product-media';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import {
  ConfidenceChip,
  OwnershipCurve,
  SectionCard,
  SignalCard,
  TrendChip,
  scoreTone,
} from '@/components/pulse/atoms';
import { ErrorState, PageSkeleton } from '@/components/states/States';

/**
 * Product 360 — one product, everything a PM needs: header metrics, the
 * long-term satisfaction curve, strengths vs. regret reasons, emerging
 * issues, honest owner cohorts, audience fit and the live signal feed.
 */
export default function PulseProduct360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { periodDays } = usePulse();
  const [data, setData] = useState<PulseProduct360Dto | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    api.pulse
      .product360(id, periodDays, { cache: 'no-store' })
      .then(setData)
      .catch(() => setError(true));
  }, [id, periodDays]);

  useEffect(load, [load]);

  const createActionFromSignal = (signal: PulseSignalDto) => {
    const params = new URLSearchParams({
      productId: signal.productId,
      title: signal.title,
      trigger: signal.description,
      triggerKey: signal.kind,
    });
    router.push(`/pulse/massnahmen?neu=1&${params.toString()}`);
  };

  if (error)
    return (
      <ErrorState
        description="Produkt konnte nicht geladen werden (ist es noch im Portfolio?)."
        action={
          <Link href="/pulse/produkte" className="text-[0.85rem] font-medium text-accent-ink">
            Zurück zu den Produkten
          </Link>
        }
      />
    );
  if (!data) return <PageSkeleton />;

  const m = data.metrics;
  const p = m.product;

  return (
    <div className="animate-fade space-y-5">
      <Link
        href="/pulse/produkte"
        className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-muted-foreground hover:text-label"
      >
        <ArrowLeft className="h-4 w-4" /> Produkte
      </Link>

      {/* Header */}
      <header className="card flex flex-col gap-5 p-5 md:flex-row md:items-center">
        <Image
          src={productThumbUrl(p)}
          alt={p.canonicalName}
          width={96}
          height={96}
          unoptimized
          className="h-24 w-24 shrink-0 rounded-[1rem] bg-surface-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[1.4rem] font-bold tracking-tight text-label">
              {p.canonicalName}
            </h1>
            {p.wudlySeal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.72rem] font-semibold text-accent-ink">
                <BadgeCheck className="h-3.5 w-3.5" /> Wudly-empfohlen
              </span>
            )}
          </div>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            {[p.brand, p.category?.name, data.variantNames.length > 0 ? `${data.variantNames.length} Varianten` : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.82rem] text-muted-foreground">
            <span>
              {m.experienceCount} Erfahrungen · {m.verifiedShare} % verifiziert ·{' '}
              {m.longTermCount} Langzeit
            </span>
            {m.typicalOwnership && <span>{m.typicalOwnership}</span>}
            <ConfidenceChip confidence={m.confidence} />
            {data.externalAvgPercent !== null && (
              <span title="Bewertungen anderswo — nie Teil des Wudly-Signals">
                Netz-Konsens {data.externalAvgPercent} % ({data.externalSourceCount} Quellen)
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-6 md:gap-8">
          <HeaderScore label="Health" value={m.healthIndex} />
          <HeaderScore label="Wiederkauf" value={m.rebuyScore} extra={<TrendChip delta={m.trend.delta} />} />
          <HeaderScore label="Kaufreue" value={m.regretScore} invert />
        </div>
      </header>

      {data.aiHeadline && (
        <p className="rounded-[1rem] bg-accent-soft px-4 py-3 text-[0.92rem] font-medium leading-relaxed text-accent-ink">
          „{data.aiHeadline}“
        </p>
      )}

      {/* Curve */}
      <SectionCard
        title="Langzeit-Zufriedenheit"
        subtitle="Wiederkaufquote nach echter Besitzdauer — bleibt die Zufriedenheit stabil oder fällt sie mit der Zeit?"
      >
        <OwnershipCurve points={data.curve} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Strengths */}
        <SectionCard title="Stärken" subtitle="Warum Besitzer das Produkt mögen.">
          <AspectList
            items={data.strengths}
            emptyText="Noch keine positiven Aspekte genannt."
            positive
          />
        </SectionCard>

        {/* Regret reasons */}
        <SectionCard
          title="Kaufreue-Gründe"
          subtitle="Warum Besitzer nicht erneut kaufen würden."
        >
          <AspectList items={data.regretReasons} emptyText="Keine Kaufreue-Gründe genannt." />
          {data.insteadOfHighlights.length > 0 && (
            <p className="mt-3 border-t border-separator pt-3 text-[0.83rem] text-muted-foreground">
              <span className="font-medium text-label-2">Hätten stattdessen gekauft:</span>{' '}
              {data.insteadOfHighlights.join(', ')}
            </p>
          )}
        </SectionCard>

        {/* Emerging issues */}
        <SectionCard
          title="Neue & zunehmende Probleme"
          subtitle={`Themen, die in den letzten ${periodDays} Tagen neu oder häufiger auftreten.`}
        >
          {data.emergingIssues.length === 0 ? (
            <p className="text-[0.85rem] text-muted-foreground">
              Kein Thema ist aktuell neu oder klar steigend. 👍
            </p>
          ) : (
            <ul className="space-y-2">
              {data.emergingIssues.map((issue) => (
                <li key={issue.key} className="flex items-center justify-between gap-3">
                  <span className="text-[0.9rem] text-label">{issue.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[0.72rem] font-semibold',
                      issue.trend === 'new'
                        ? 'bg-unsure-soft text-unsure-ink'
                        : 'bg-regret-soft text-regret-ink',
                    )}
                  >
                    {issue.trend === 'new'
                      ? `neu · ${issue.count}×`
                      : `${issue.previousCount} → ${issue.count}×`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Segments */}
        <SectionCard
          title="Betroffene Besitzergruppen"
          subtitle="Nur ehrliche Kohorten, die Wudly wirklich kennt: Verifizierung, Besitzdauer, Variante."
        >
          {data.segments.length === 0 ? (
            <p className="text-[0.85rem] text-muted-foreground">
              Noch zu wenige Stimmen für eine Gruppenauswertung.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.segments.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span className="text-[0.9rem] text-label">
                    {s.label}{' '}
                    <span className="text-[0.78rem] text-label-3">({s.count})</span>
                  </span>
                  <span
                    className={cn(
                      'font-display text-[1.05rem] font-bold tnum',
                      s.tone === 'positive'
                        ? 'text-positive-ink'
                        : s.tone === 'negative'
                          ? 'text-regret-ink'
                          : 'text-label',
                    )}
                  >
                    {s.rebuyScore ?? '–'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Audience fit */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Geeignet für">
          <TagList items={data.suitedFor} tone="positive" emptyText="Noch keine Einschätzung." />
        </SectionCard>
        <SectionCard title="Weniger geeignet für">
          <TagList items={data.notSuitedFor} tone="negative" emptyText="Noch keine Einschätzung." />
        </SectionCard>
      </div>

      {/* Signals */}
      {data.signals.length > 0 && (
        <section>
          <h2 className="mb-3 text-[1.1rem] font-bold tracking-tight text-label">
            Aktive Signale
          </h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {data.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} onCreateAction={createActionFromSignal} />
            ))}
          </div>
        </section>
      )}

      {/* Recent voices */}
      <SectionCard
        title="Neueste Besitzerstimmen"
        subtitle="Anonymisiert — die vollständige Ansicht mit Filtern liegt unter Kundenfeedback."
      >
        {data.recentVoices.length === 0 ? (
          <p className="text-[0.85rem] text-muted-foreground">Noch keine Erfahrungsberichte.</p>
        ) : (
          <ul className="divide-y divide-separator">
            {data.recentVoices.map((voice) => (
              <li key={voice.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-foreground">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
                      voice.wouldBuyAgain === 'YES'
                        ? 'bg-positive-soft text-positive-ink'
                        : voice.wouldBuyAgain === 'NO'
                          ? 'bg-regret-soft text-regret-ink'
                          : 'bg-unsure-soft text-unsure-ink',
                    )}
                  >
                    {voice.wouldBuyAgain === 'YES' ? (
                      <ThumbsUp className="h-3 w-3" />
                    ) : voice.wouldBuyAgain === 'NO' ? (
                      <ThumbsDown className="h-3 w-3" />
                    ) : null}
                    {WOULD_BUY_AGAIN_LABEL[voice.wouldBuyAgain]}
                  </span>
                  <span>{USAGE_DURATION_LABEL[voice.usageDuration]}</span>
                  {voice.verificationStatus === 'VERIFIED' && (
                    <span className="text-accent-ink">verifizierter Käufer</span>
                  )}
                </div>
                {voice.freeText && (
                  <p className="mt-1.5 text-[0.9rem] leading-relaxed text-label-2">
                    „{voice.freeText}“
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function HeaderScore({
  label,
  value,
  invert,
  extra,
}: {
  label: string;
  value: number | null;
  invert?: boolean;
  extra?: React.ReactNode;
}) {
  const tone =
    value === null
      ? 'text-label-3'
      : invert
        ? value >= 30
          ? 'text-regret-ink'
          : value >= 15
            ? 'text-unsure-ink'
            : 'text-positive-ink'
        : scoreTone(value);
  return (
    <div className="text-center">
      <div className={cn('font-display text-[2rem] font-bold leading-none tnum', tone)}>
        {value ?? '–'}
      </div>
      <div className="mt-1 text-[0.7rem] font-medium uppercase tracking-wide text-label-3">
        {label}
      </div>
      {extra && <div className="mt-1">{extra}</div>}
    </div>
  );
}

function AspectList({
  items,
  emptyText,
  positive,
}: {
  items: Array<{ key: string; label: string; count: number }>;
  emptyText: string;
  positive?: boolean;
}) {
  if (items.length === 0)
    return <p className="text-[0.85rem] text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1 flex items-center justify-between text-[0.88rem]">
            <span className="text-label">{item.label}</span>
            <span className="text-label-3 tnum">{item.count}×</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fill-2">
            <div
              className={cn('h-full rounded-full', positive ? 'bg-positive' : 'bg-regret')}
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TagList({
  items,
  tone,
  emptyText,
}: {
  items: string[];
  tone: 'positive' | 'negative';
  emptyText: string;
}) {
  if (items.length === 0)
    return <p className="text-[0.85rem] text-muted-foreground">{emptyText}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            'rounded-full px-3 py-1 text-[0.83rem] font-medium',
            tone === 'positive'
              ? 'bg-positive-soft text-positive-ink'
              : 'bg-regret-soft text-regret-ink',
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
