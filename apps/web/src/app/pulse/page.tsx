'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PulseOverviewDto, PulseSignalDto } from '@wudly/shared';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { usePulse } from '@/components/pulse/PulseShell';
import { ConfidenceChip, KpiCard, SignalCard } from '@/components/pulse/atoms';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/states/States';

/**
 * Übersicht — the Product Health Command Center. One screen that answers:
 * how healthy is the portfolio, what needs attention today, what works.
 */
export default function PulseOverviewPage() {
  const router = useRouter();
  const { periodDays, profile } = usePulse();
  const [data, setData] = useState<PulseOverviewDto | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api.pulse
      .overview(periodDays, { cache: 'no-store' })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [periodDays]);

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

  if (loading) return <PageSkeleton />;
  if (error || !data)
    return (
      <ErrorState
        description="Die Übersicht konnte nicht geladen werden."
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

  const fmt = (v: number | null) => (v === null ? '–' : String(v));

  return (
    <div className="animate-fade space-y-6">
      <header>
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
          Guten Tag, {profile.displayName}
        </h1>
        <p className="mt-1 text-[0.92rem] text-muted-foreground">
          Product Health über {data.productCount} beobachtete{' '}
          {data.productCount === 1 ? 'Produkt' : 'Produkte'} — Trends im Vergleich zur
          Vorperiode ({periodDays} Tage). <ConfidenceChip confidence={data.confidence} />
        </p>
      </header>

      {data.productCount === 0 ? (
        <EmptyState
          title="Noch keine Produkte im Portfolio"
          description="Füge unter „Produkte“ die Produkte hinzu, die du beobachten willst — danach füllt sich das Command Center automatisch."
          action={
            <Link
              href="/pulse/produkte"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-foreground"
            >
              Produkte hinzufügen <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              label="Product Health Index"
              value={fmt(data.healthIndex)}
              trend={data.healthTrend}
              hint="Wiederkauf minus Kaufreue-Abzug, 0–100 über das ganze Portfolio."
            />
            <KpiCard
              label="Wiederkaufquote"
              value={fmt(data.rebuyScore)}
              trend={data.rebuyTrend}
              hint="Anteil der Besitzer, die wieder kaufen würden (gewichtet nach Besitzdauer & Verifizierung)."
            />
            <KpiCard
              label="Besitzererfahrungen"
              value={String(data.experienceCount)}
              hint={`Davon ${data.longTermExperienceCount} Langzeit (6+ Monate) · ${data.verifiedShare} % verifiziert.`}
            />
            <KpiCard
              label="Handlungsbedarf"
              value={String(data.attentionProductCount)}
              hint={
                data.criticalSignalCount > 0
                  ? `${data.criticalSignalCount} kritische ${data.criticalSignalCount === 1 ? 'Warnung' : 'Warnungen'} aktiv.`
                  : 'Keine kritischen Warnungen.'
              }
            />
          </div>

          {/* Needs attention */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[1.1rem] font-bold tracking-tight text-label">
                Benötigt jetzt Aufmerksamkeit
              </h2>
              <Link
                href="/pulse/signale"
                className="text-[0.83rem] font-medium text-accent-ink hover:underline"
              >
                Alle Signale →
              </Link>
            </div>
            {data.attention.length === 0 ? (
              <div className="card flex items-center gap-3 p-5">
                <CheckCircle2 className="h-6 w-6 text-positive" strokeWidth={2.2} />
                <div>
                  <div className="font-semibold text-label">Nichts Kritisches heute</div>
                  <p className="text-[0.85rem] text-muted-foreground">
                    Kein Produkt zeigt aktuell ein kritisches oder relevantes Warnsignal.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {data.attention.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    onCreateAction={createActionFromSignal}
                  />
                ))}
              </div>
            )}
          </section>

          {/* What works */}
          <section>
            <h2 className="mb-3 text-[1.1rem] font-bold tracking-tight text-label">
              Was läuft gut?
            </h2>
            {data.positives.length === 0 ? (
              <p className="text-[0.88rem] text-muted-foreground">
                In dieser Periode gibt es noch keinen messbar positiven Trend — sobald sich eine
                Kennzahl sichtbar verbessert, erscheint sie hier.
              </p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {data.positives.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
