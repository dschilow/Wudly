'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useInView } from 'motion/react';
import { cn, formatScore } from '@/lib/utils';

type Tone = 'positive' | 'regret' | 'unsure' | 'auto';

interface ScoreRingProps {
  score: number | null;
  /** Visual color. 'auto' picks green/amber/red by the rebuy value. */
  tone?: Tone;
  size?: number;
  label?: string;
  className?: string;
  /** Animate the arc + number counting up when scrolled into view. */
  animate?: boolean;
}

function resolveColor(score: number | null, tone: Tone): string {
  if (tone === 'positive') return 'var(--color-positive)';
  if (tone === 'regret') return 'var(--color-regret)';
  if (tone === 'unsure') return 'var(--color-unsure)';
  if (score === null) return 'var(--color-faint)';
  if (score >= 75) return 'var(--color-positive)';
  if (score >= 50) return 'var(--color-unsure)';
  return 'var(--color-regret)';
}

/**
 * Circular score gauge rendered with a conic-gradient ring (no SVG/deps).
 * Animates the arc sweep and a number count-up the first time it enters view.
 */
export function ScoreRing({
  score,
  tone = 'auto',
  size = 92,
  label,
  className,
  animate = true,
}: ScoreRingProps) {
  const color = resolveColor(score, tone);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(animate ? 0 : (score ?? 0));

  useEffect(() => {
    if (score === null) return;
    if (!animate) {
      setDisplay(score);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, score, animate]);

  const shown = score === null ? null : display;
  const inner = size - 9; // thinner ring than before (more refined)
  const ringStyle: CSSProperties = {
    width: size,
    height: size,
    // @ts-expect-error CSS custom props
    '--score': animate ? (inView ? (score ?? 0) : 0) : (score ?? 0),
    '--ring-color': color,
    transition: 'background 0.9s var(--ease-ios)',
  };

  return (
    <div ref={ref} className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="score-ring grid place-items-center rounded-full" style={ringStyle}>
        <div
          className="grid place-items-center rounded-full bg-surface"
          style={{ width: inner, height: inner }}
        >
          <span className="text-[1.5rem] font-semibold tnum leading-none" style={{ color }}>
            {formatScore(shown)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[0.8125rem] font-normal text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
