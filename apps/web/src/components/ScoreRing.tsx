import { cn, formatScore } from '@/lib/utils';
import type { CSSProperties } from 'react';

type Tone = 'positive' | 'regret' | 'unsure' | 'auto';

interface ScoreRingProps {
  score: number | null;
  /** Visual color. 'auto' picks green/amber/red by the rebuy value. */
  tone?: Tone;
  size?: number;
  label?: string;
  className?: string;
}

function resolveColor(score: number | null, tone: Tone): string {
  if (tone === 'positive') return 'var(--color-positive)';
  if (tone === 'regret') return 'var(--color-regret)';
  if (tone === 'unsure') return 'var(--color-unsure)';
  // auto: rebuy-style coloring
  if (score === null) return 'var(--color-border-strong)';
  if (score >= 75) return 'var(--color-positive)';
  if (score >= 50) return 'var(--color-unsure)';
  return 'var(--color-regret)';
}

/**
 * Circular score gauge rendered with a conic-gradient ring (no SVG/deps).
 * The score number sits in the center; the arc length reflects the 0..100 value.
 */
export function ScoreRing({ score, tone = 'auto', size = 96, label, className }: ScoreRingProps) {
  const color = resolveColor(score, tone);
  const ringStyle: CSSProperties = {
    width: size,
    height: size,
    // @ts-expect-error CSS custom props
    '--score': score ?? 0,
    '--ring-color': color,
  };
  const inner = size - 14;

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="score-ring grid place-items-center rounded-full" style={ringStyle}>
        <div
          className="grid place-items-center rounded-full bg-surface"
          style={{ width: inner, height: inner }}
        >
          <span className="text-2xl font-extrabold tabular-nums" style={{ color }}>
            {formatScore(score)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
