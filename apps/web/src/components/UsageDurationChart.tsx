'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { USAGE_DURATION_OPTIONS, type UsageDuration } from '@wudly/shared';
import { cn } from '@/lib/utils';

interface UsageDurationChartProps {
  stats: Record<UsageDuration, number>;
}

/**
 * Horizontal distribution of how long owners have used the product. Bars grow
 * in with a staggered spring when scrolled into view; the dominant duration is
 * emphasized so the takeaway ("most owners are past 6 months") reads instantly.
 */
export function UsageDurationChart({ stats }: UsageDurationChartProps) {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return (
      <p className="text-[0.9375rem] text-muted-foreground">Noch keine Angaben zur Nutzungsdauer.</p>
    );
  }
  const max = Math.max(...Object.values(stats));

  return (
    <ul ref={ref} className="space-y-3">
      {USAGE_DURATION_OPTIONS.map((opt, i) => {
        const count = stats[opt.value] ?? 0;
        const pct = (count / total) * 100;
        const dominant = count === max && count > 0;
        return (
          <li key={opt.value} className="flex items-center gap-3">
            <span
              className={cn(
                'w-32 shrink-0 text-[0.8125rem]',
                dominant ? 'font-semibold text-label' : 'text-muted-foreground',
              )}
            >
              {opt.label}
            </span>
            <div className="h-[0.4375rem] flex-1 overflow-hidden rounded-full bg-fill-2">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{
                  width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                  background: dominant
                    ? 'linear-gradient(90deg, var(--brand-mid), var(--color-accent))'
                    : 'color-mix(in srgb, var(--color-accent) 55%, transparent)',
                }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={inView || reduced ? { scaleX: 1 } : undefined}
                transition={{
                  type: 'spring',
                  stiffness: 170,
                  damping: 26,
                  delay: i * 0.07,
                }}
              />
            </div>
            <span
              className={cn(
                'mono-data w-10 shrink-0 text-right text-[0.8125rem]',
                dominant ? 'font-semibold text-label' : 'text-faint',
              )}
            >
              {Math.round(pct)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
