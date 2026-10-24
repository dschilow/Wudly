'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Scale } from 'lucide-react';
import { USAGE_DURATION_WEIGHT } from '@wudly/shared';
import { formatWeight } from '@/lib/companion';

const MIN = Math.min(...Object.values(USAGE_DURATION_WEIGHT));
const MAX = Math.max(...Object.values(USAGE_DURATION_WEIGHT));
const share = (weight: number) => (weight / MAX) * 100;

/**
 * How much the owner's verdict counts in the Wudly score — and how much more it
 * will after a check-in. Longer real use weighs more (0,5× … 1,5×); making that
 * visible is the honest answer to "why should I check in again?".
 */
export function WeightMeter({
  current,
  next,
}: {
  /** Weight of the latest verdict (null without any). */
  current: number | null;
  /** Weight after a check-in today (only shown when it grows). */
  next?: number | null;
}) {
  const reduced = useReducedMotion();
  const grows = next != null && (current === null || next > current);
  const shown = current ?? 0;

  return (
    <div className="rounded-[var(--radius-lg)] bg-fill p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.7rem] bg-accent-soft text-accent-ink">
          <Scale className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold leading-snug text-label">
            {current === null ? (
              next != null ? (
                <>
                  Dein erstes Urteil zählt{' '}
                  <span className="text-accent-ink">{formatWeight(next)}</span>
                </>
              ) : (
                'Dein Urteil zählt, sobald du es abgibst'
              )
            ) : (
              <>
                Dein Urteil zählt aktuell {formatWeight(current)}
                {grows && (
                  <span className="text-accent-ink">
                    {' '}
                    – nach dem Check-in {formatWeight(next!)}
                  </span>
                )}
              </>
            )}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
            Je länger du ein Produkt nutzt, desto mehr Gewicht hat dein Urteil im Wudly Score.
          </p>
        </div>
      </div>

      <div className="relative mt-3.5 h-2 overflow-hidden rounded-full bg-fill-2">
        {grows && (
          <motion.span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full bg-accent/30"
            initial={reduced ? false : { width: `${share(shown)}%` }}
            animate={{ width: `${share(next!)}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 16, delay: 0.5 }}
          />
        )}
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${share(shown)}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.15 }}
        />
      </div>
      <div className="mono-data mt-1.5 flex justify-between text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">
        <span>Erste Tage {formatWeight(MIN)}</span>
        <span>Über 1 Jahr {formatWeight(MAX)}</span>
      </div>
    </div>
  );
}
