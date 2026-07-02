'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PULSE_SIGNAL_SEVERITY_LABEL,
  type PulseSignalDto,
  type PulseSignalSeverity,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import { SignalCard } from '@/components/pulse/atoms';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/states/States';

const FILTERS: Array<{ key: PulseSignalSeverity | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Alle' },
  { key: 'CRITICAL', label: PULSE_SIGNAL_SEVERITY_LABEL.CRITICAL ?? 'Kritisch' },
  { key: 'RELEVANT', label: PULSE_SIGNAL_SEVERITY_LABEL.RELEVANT ?? 'Relevant' },
  { key: 'WATCH', label: PULSE_SIGNAL_SEVERITY_LABEL.WATCH ?? 'Beobachten' },
  { key: 'POSITIVE', label: PULSE_SIGNAL_SEVERITY_LABEL.POSITIVE ?? 'Positiver Trend' },
];

/**
 * Signale & Warnungen — the prioritized early-warning center. Every signal
 * says what changed, why, who is affected and what to do; one click turns it
 * into a measure on the action board.
 */
export default function PulseSignalsPage() {
  const router = useRouter();
  const { periodDays } = usePulse();
  const [signals, setSignals] = useState<PulseSignalDto[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<PulseSignalSeverity | 'ALL'>('ALL');

  const load = useCallback(() => {
    setError(false);
    api.pulse
      .signals(periodDays, { cache: 'no-store' })
      .then(setSignals)
      .catch(() => setError(true));
  }, [periodDays]);

  useEffect(load, [load]);

  const filtered = useMemo(
    () => (signals ?? []).filter((s) => filter === 'ALL' || s.severity === filter),
    [signals, filter],
  );
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of signals ?? []) map.set(s.severity, (map.get(s.severity) ?? 0) + 1);
    return map;
  }, [signals]);

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
        description="Signale konnten nicht geladen werden."
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
  if (!signals) return <PageSkeleton />;

  return (
    <div className="animate-fade space-y-5">
      <header>
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
          Signale & Warnungen
        </h1>
        <p className="mt-1 text-[0.92rem] text-muted-foreground">
          Live aus den Besitzerstimmen abgeleitet ({periodDays}-Tage-Fenster vs. Vorperiode) —
          priorisiert, verständlich, mit konkreter Empfehlung.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[0.83rem] font-medium transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-fill-2 text-muted-foreground hover:text-label',
            )}
          >
            {f.label}
            {f.key !== 'ALL' && counts.get(f.key) ? ` · ${counts.get(f.key)}` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={filter === 'ALL' ? 'Keine Signale' : 'Keine Signale in dieser Kategorie'}
          description="Signale entstehen automatisch, sobald sich Kennzahlen oder Problemthemen in deinem Portfolio messbar bewegen."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((signal) => (
            <SignalCard key={signal.id} signal={signal} onCreateAction={createActionFromSignal} />
          ))}
        </div>
      )}
    </div>
  );
}
