'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
 * Wudly's signature score gauge — an Apple-Watch-style activity ring rendered in
 * SVG: a faint full-circle track, a gradient progress arc with round end-caps and
 * a soft same-hue glow, plus a number that counts up. The arc sweeps and the
 * number tick up the first time the ring scrolls into view (respecting
 * prefers-reduced-motion, which neutralizes the CSS transition globally).
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
  const uid = useId().replace(/[:]/g, '');
  const gradientId = `ring-grad-${uid}`;
  const glowId = `ring-glow-${uid}`;

  useEffect(() => {
    if (score === null) return;
    if (!animate) {
      setDisplay(score);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 950;
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

  // Geometry in a 100×100 viewBox so the ring scales cleanly to any `size`.
  const strokePx = Math.max(8, Math.round(size * 0.092));
  const stroke = (strokePx / size) * 100;
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const activePct = animate ? (inView ? pct : 0) : pct;
  const dashOffset = circumference * (1 - activePct / 100);
  const numberSize = Math.max(22, Math.round(size * 0.25));

  return (
    <div ref={ref} className={cn('inline-flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.72" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="1.7"
                floodColor={color}
                floodOpacity="0.45"
              />
            </filter>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--color-fill-2)"
            strokeWidth={stroke}
          />
          {score !== null && activePct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              filter={`url(#${glowId})`}
              style={{ transition: 'stroke-dashoffset 1.1s var(--ease-ios)' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span
            className="font-semibold tnum leading-none"
            style={{ color, fontSize: numberSize }}
          >
            {formatScore(shown)}
            {shown !== null && <span className="text-[0.5em] font-bold">%</span>}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[0.8125rem] font-normal text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
