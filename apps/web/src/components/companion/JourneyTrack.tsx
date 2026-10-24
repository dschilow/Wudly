'use client';

import { motion, useReducedMotion } from 'motion/react';
import { BellRing } from 'lucide-react';
import type { CheckInJourney, JourneyMilestone } from '@wudly/shared';
import { cn } from '@/lib/utils';
import {
  journeyAriaLabel,
  MILESTONE_STATE_LABEL,
  monthYear,
  trackPosition,
  VERDICT_STYLE,
} from '@/lib/companion';

type Tone = 'card' | 'canvas' | 'dark';

/** Hollow nodes are filled with the surface below so the rail never shows through. */
const HOLLOW_FILL: Record<Tone, string> = {
  card: 'bg-surface',
  canvas: 'bg-canvas',
  dark: 'bg-[#12131a]',
};

/**
 * The companion journey as a horizontal track: Start → 1 Monat → 6 Monate →
 * 1 Jahr → 2 Jahre. The accent line draws itself up to "today"; finished
 * check-ins show the verdict given back then, the due one pulses.
 */
export function JourneyTrack({
  journey,
  tone = 'card',
  size = 'sm',
  showLabels = true,
  showDates = false,
  className,
}: {
  journey: CheckInJourney;
  tone?: Tone;
  size?: 'sm' | 'md';
  showLabels?: boolean;
  /** Second label line: when each stage happened or comes up. */
  showDates?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const dark = tone === 'dark';
  const position = trackPosition(journey.ageDays);
  // Nodes sit in the centre of five equal columns: the rail runs 10 % → 90 %.
  const todayLeft = `${10 + position * 80}%`;
  const rowHeight = size === 'md' ? 'h-9' : 'h-7';

  return (
    <div className={cn('select-none', className)} role="img" aria-label={journeyAriaLabel(journey)}>
      <div className={cn('relative', rowHeight)}>
        <span
          aria-hidden
          className={cn(
            'absolute left-[10%] right-[10%] top-1/2 h-[3px] -translate-y-1/2 rounded-full',
            dark ? 'bg-white/12' : 'bg-fill-2',
          )}
        />
        <motion.span
          aria-hidden
          className="absolute left-[10%] top-1/2 h-[3px] origin-left -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]"
          style={{ width: `${position * 80}%` }}
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.1 }}
        />

        <div className="relative grid h-full grid-cols-5">
          {journey.milestones.map((milestone, i) => (
            <div key={milestone.key} className="grid place-items-center">
              <motion.span
                initial={reduced ? false : { scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.15 + i * 0.07 }}
              >
                <TrackNode milestone={milestone} tone={tone} size={size} />
              </motion.span>
            </div>
          ))}
        </div>

        {/* "Heute" — where the owner is right now. */}
        {position > 0 && position < 1 && (
          <motion.span
            aria-hidden
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-[3px] ring-accent/25"
            style={{ left: todayLeft }}
            initial={reduced ? false : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.75, type: 'spring', stiffness: 380, damping: 20 }}
          />
        )}
      </div>

      {showLabels && (
        <div className="mt-1.5 grid grid-cols-5">
          {journey.milestones.map((milestone) => (
            <div key={milestone.key} className="min-w-0 text-center leading-tight">
              <span
                className={cn(
                  'mono-data block truncate text-[0.625rem] font-semibold uppercase tracking-[0.04em]',
                  milestone.state === 'due'
                    ? dark
                      ? 'text-[#7df2c2]'
                      : 'text-accent-ink'
                    : milestone.state === 'done'
                      ? dark
                        ? 'text-white/85'
                        : 'text-label'
                      : dark
                        ? 'text-white/40'
                        : 'text-faint',
                )}
              >
                {milestone.label}
              </span>
              {showDates && (
                <span
                  className={cn(
                    'mt-0.5 block truncate text-[0.625rem]',
                    dark ? 'text-white/45' : 'text-muted-foreground',
                  )}
                >
                  {nodeDate(milestone)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function nodeDate(milestone: JourneyMilestone): string {
  if (milestone.state === 'done' && milestone.checkIn) return monthYear(milestone.checkIn.at);
  if (milestone.state === 'upcoming') return monthYear(milestone.dueAt);
  return MILESTONE_STATE_LABEL[milestone.state];
}

function TrackNode({
  milestone,
  tone,
  size,
}: {
  milestone: JourneyMilestone;
  tone: Tone;
  size: 'sm' | 'md';
}) {
  const reduced = useReducedMotion();
  const dark = tone === 'dark';
  const box = size === 'md' ? 'h-7 w-7' : 'h-5 w-5';
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-[0.7rem] w-[0.7rem]';

  if (milestone.state === 'done' && milestone.checkIn) {
    const verdict = VERDICT_STYLE[milestone.checkIn.wouldBuyAgain];
    const Icon = verdict.icon;
    return (
      <span
        className={cn(
          'grid place-items-center rounded-full text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]',
          box,
          verdict.solid,
        )}
      >
        <Icon className={icon} strokeWidth={2.8} aria-hidden />
      </span>
    );
  }

  if (milestone.state === 'due') {
    return (
      <span className={cn('relative grid place-items-center', box)}>
        {!reduced && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-accent"
            animate={{ scale: [1, 2], opacity: [0.45, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className={cn(
            'relative grid place-items-center rounded-full bg-accent text-white shadow-[var(--shadow-glow)]',
            box,
          )}
        >
          <BellRing className={icon} strokeWidth={2.6} aria-hidden />
        </span>
      </span>
    );
  }

  if (milestone.state === 'before') {
    return (
      <span
        className={cn('block h-2 w-2 rounded-full', dark ? 'bg-white/20' : 'bg-label-4')}
        aria-hidden
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-full border-2',
        size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5',
        HOLLOW_FILL[tone],
        milestone.state === 'upcoming'
          ? dark
            ? 'border-white/35'
            : 'border-border-strong'
          : cn('border-dashed', dark ? 'border-white/20' : 'border-label-4'),
      )}
    />
  );
}
