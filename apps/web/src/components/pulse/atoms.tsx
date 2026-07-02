'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  PULSE_CONFIDENCE_LABEL,
  PULSE_SIGNAL_SEVERITY_LABEL,
  type PulseConfidence,
  type PulseCurvePointDto,
  type PulseSignalDto,
  type PulseSignalSeverity,
  type PulseTrendDto,
} from '@wudly/shared';
import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ *
 * Small, reusable Pulse atoms — quiet, data-first, Verdict tokens only.
 * ------------------------------------------------------------------ */

/** ±delta chip. Positive = emerald, negative = regret red, flat = neutral. */
export function TrendChip({
  delta,
  suffix = 'Pkt.',
  invert = false,
}: {
  delta: number | null;
  /** Unit shown after the number. */
  suffix?: string;
  /** Set when "down is good" (e.g. Kaufreue). */
  invert?: boolean;
}) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-fill-2 px-2 py-0.5 text-[0.72rem] font-medium text-label-3">
        <Minus className="h-3 w-3" /> kein Vergleich
      </span>
    );
  }
  const good = invert ? delta < 0 : delta > 0;
  const flat = delta === 0;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold tnum',
        flat
          ? 'bg-fill-2 text-label-3'
          : good
            ? 'bg-positive-soft text-positive-ink'
            : 'bg-regret-soft text-regret-ink',
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {delta > 0 ? '+' : ''}
      {delta} {suffix}
    </span>
  );
}

/** How much data is behind a number — every Pulse metric carries one. */
export function ConfidenceChip({ confidence }: { confidence: PulseConfidence }) {
  const tone =
    confidence === 'HIGH'
      ? 'bg-positive-soft text-positive-ink'
      : confidence === 'MEDIUM'
        ? 'bg-fill-2 text-muted-foreground'
        : 'bg-unsure-soft text-unsure-ink';
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-medium', tone)}
      title="Vertrauensniveau: Wie viele echte Besitzerstimmen hinter diesem Wert stehen."
    >
      <ShieldCheck className="h-3 w-3" strokeWidth={2.4} />
      {PULSE_CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

const SEVERITY_TONE: Record<PulseSignalSeverity, string> = {
  CRITICAL: 'bg-regret-soft text-regret-ink',
  RELEVANT: 'bg-unsure-soft text-unsure-ink',
  WATCH: 'bg-fill-2 text-muted-foreground',
  POSITIVE: 'bg-positive-soft text-positive-ink',
};

export function SeverityBadge({ severity }: { severity: PulseSignalSeverity }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide',
        SEVERITY_TONE[severity],
      )}
    >
      {PULSE_SIGNAL_SEVERITY_LABEL[severity]}
    </span>
  );
}

/** Executive KPI card: big display number, context line, optional trend. */
export function KpiCard({
  label,
  value,
  hint,
  trend,
  invert,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: PulseTrendDto | null;
  invert?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-1.5 p-4">
      <div className="text-[0.78rem] font-medium uppercase tracking-wide text-label-3">{label}</div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-[1.9rem] font-bold leading-none tracking-tight text-label tnum">
          {value}
        </span>
        {trend !== undefined && <TrendChip delta={trend?.delta ?? null} invert={invert} />}
        {children}
      </div>
      {hint && <p className="text-[0.8rem] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Score value 0–100 with a quiet color read (high good / low bad). */
export function scoreTone(score: number | null): string {
  if (score === null) return 'text-label-3';
  if (score >= 75) return 'text-positive-ink';
  if (score >= 50) return 'text-unsure-ink';
  return 'text-regret-ink';
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.02rem] font-bold tracking-tight text-label">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[0.82rem] leading-snug text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Long-term satisfaction curve — a clean inline SVG over the real
 * ownership-duration buckets (no chart library, no fake day marks).
 * ------------------------------------------------------------------ */

export function OwnershipCurve({ points }: { points: PulseCurvePointDto[] }) {
  const width = 560;
  const height = 170;
  const padX = 52;
  const padTop = 18;
  const padBottom = 40;
  const usable = points.filter((p) => p.rebuyScore !== null);

  const x = (i: number) => padX + (i * (width - 2 * padX)) / Math.max(1, points.length - 1);
  const y = (score: number) =>
    padTop + ((100 - score) * (height - padTop - padBottom)) / 100;

  const path = points
    .map((p, i) => (p.rebuyScore === null ? null : `${x(i)},${y(p.rebuyScore)}`))
    .filter((v): v is string => v !== null);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[480px] w-full"
        role="img"
        aria-label="Zufriedenheit nach Besitzdauer"
      >
        {/* Reference lines */}
        {[25, 50, 75].map((line) => (
          <g key={line}>
            <line
              x1={padX}
              x2={width - padX}
              y1={y(line)}
              y2={y(line)}
              stroke="var(--color-separator)"
              strokeDasharray="3 4"
            />
            <text x={2} y={y(line) + 3} fontSize="9" fill="var(--color-faint)">
              {line}
            </text>
          </g>
        ))}
        {/* Curve */}
        {path.length >= 2 && (
          <polyline
            points={path.join(' ')}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Points + labels */}
        {points.map((p, i) => (
          <g key={p.bucket}>
            {p.rebuyScore !== null && (
              <>
                <circle cx={x(i)} cy={y(p.rebuyScore)} r="4" fill="var(--color-accent)" />
                <text
                  x={x(i)}
                  y={y(p.rebuyScore) - 8}
                  fontSize="10.5"
                  fontWeight="700"
                  textAnchor="middle"
                  fill="var(--color-label)"
                >
                  {p.rebuyScore}
                </text>
              </>
            )}
            <text
              x={x(i)}
              y={height - 22}
              fontSize="9.5"
              textAnchor="middle"
              fill="var(--color-muted-foreground)"
            >
              {p.label}
            </text>
            <text
              x={x(i)}
              y={height - 10}
              fontSize="8.5"
              textAnchor="middle"
              fill="var(--color-faint)"
            >
              {p.count} {p.count === 1 ? 'Stimme' : 'Stimmen'}
            </text>
          </g>
        ))}
        {usable.length === 0 && (
          <text
            x={width / 2}
            y={height / 2}
            fontSize="11"
            textAnchor="middle"
            fill="var(--color-muted-foreground)"
          >
            Noch keine Daten für die Langzeitkurve
          </text>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Signal card — the "Entscheidungscenter" unit: what, why, who, next.
 * ------------------------------------------------------------------ */

export function SignalCard({
  signal,
  onCreateAction,
}: {
  signal: PulseSignalDto;
  /** When set, shows "Maßnahme anlegen" (positive signals never show it). */
  onCreateAction?: (signal: PulseSignalDto) => void;
}) {
  const positive = signal.severity === 'POSITIVE';
  return (
    <article
      className={cn(
        'card p-4',
        signal.severity === 'CRITICAL' && 'shadow-[inset_3px_0_0_0_var(--color-regret)]',
        positive && 'shadow-[inset_3px_0_0_0_var(--color-positive)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={signal.severity} />
        <ConfidenceChip confidence={signal.confidence} />
        <Link
          href={`/pulse/produkte/${signal.productId}`}
          className="ml-auto text-[0.78rem] font-medium text-accent-ink hover:underline"
        >
          {signal.productName}
        </Link>
      </div>
      <h3 className="mt-2.5 text-[0.98rem] font-bold leading-snug text-label">{signal.title}</h3>
      <p className="mt-1 text-[0.88rem] leading-relaxed text-muted-foreground">
        {signal.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-label-2">
        {signal.cause && (
          <span>
            <span className="text-label-3">Ursache:</span> {signal.cause}
          </span>
        )}
        {signal.segment && (
          <span>
            <span className="text-label-3">Betroffen:</span> {signal.segment}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[0.75rem] bg-fill p-3">
        <p className="flex-1 text-[0.83rem] leading-snug text-label-2">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
          {signal.recommendation}
        </p>
        {onCreateAction && !positive && (
          <button
            type="button"
            onClick={() => onCreateAction(signal)}
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-[0.8rem] font-semibold text-primary-foreground active:opacity-85"
          >
            Maßnahme anlegen
          </button>
        )}
      </div>
    </article>
  );
}
