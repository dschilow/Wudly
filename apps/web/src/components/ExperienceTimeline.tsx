'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import type { ExperienceDto } from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  EXPERIENCE_MOOD_OPTIONS,
  USAGE_DURATION_LABEL,
} from '@wudly/shared';
import { BadgeCheck, History, Minus, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Pill } from './ui/Pill';

const buyAgainMap = Object.fromEntries(WOULD_BUY_AGAIN_OPTIONS.map((o) => [o.value, o]));
const moodMap = Object.fromEntries(EXPERIENCE_MOOD_OPTIONS.map((o) => [o.value, o]));

const toneToPill = {
  positive: 'positive',
  negative: 'negative',
  warning: 'unsure',
  neutral: 'neutral',
} as const;

const VERDICT_COLOR: Record<string, string> = {
  YES: 'var(--color-positive)',
  NO: 'var(--color-regret)',
  UNSURE: 'var(--color-unsure)',
};
const VERDICT_ICON: Record<string, LucideIcon> = {
  YES: ThumbsUp,
  NO: ThumbsDown,
  UNSURE: Minus,
};

/** The "purchase → verdict" span, phrased as time *since* buying. */
const USAGE_SINCE: Record<string, string> = {
  LESS_THAN_WEEK: 'Nach wenigen Tagen',
  ONE_TO_FOUR_WEEKS: 'Nach einigen Wochen',
  ONE_TO_SIX_MONTHS: 'Nach einigen Monaten',
  SIX_TO_TWELVE_MONTHS: 'Nach 6–12 Monaten',
  MORE_THAN_YEAR: 'Nach über 1 Jahr',
};

/** How many nodes to show before collapsing the older tail into a summary. */
const INITIAL = 6;

function TimelineNode({ exp, newest }: { exp: ExperienceDto; newest: boolean }) {
  const reduced = useReducedMotion();
  const buy = buyAgainMap[exp.wouldBuyAgain];
  const mood = moodMap[exp.experienceMood];
  const lead = exp.freeText ?? exp.wishKnownText;
  const color = VERDICT_COLOR[exp.wouldBuyAgain] ?? 'var(--color-faint)';
  const Icon = VERDICT_ICON[exp.wouldBuyAgain] ?? Minus;

  return (
    <motion.li
      className="relative pl-14"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.55 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Verdict node: a colored dot with a thumb icon, punched through the rail. */}
      <span className="absolute left-5 top-0.5 -translate-x-1/2">
        {newest && !reduced && (
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full"
            style={{ background: color, opacity: 0.35 }}
          />
        )}
        <span
          className="relative grid h-7 w-7 place-items-center rounded-full text-white"
          style={{ background: color, boxShadow: '0 0 0 4px var(--color-canvas)' }}
        >
          <Icon className="h-[0.95rem] w-[0.95rem]" strokeWidth={2.6} aria-hidden />
        </span>
      </span>

      {/* The journey marker — time since purchase, in the verdict's color. */}
      <p className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.12em]" style={{ color }}>
        {USAGE_SINCE[exp.usageDuration] ?? USAGE_DURATION_LABEL[exp.usageDuration]}
        <span className="font-normal text-faint"> · {formatDate(exp.createdAt)}</span>
      </p>

      <div className="card mt-2 p-4">
        {lead ? (
          <p className="font-display text-[1.15rem] italic leading-snug text-label">»{lead}«</p>
        ) : mood ? (
          <p className="text-[1rem] leading-snug text-label">
            {mood.emoji} {mood.label}
          </p>
        ) : null}

        {((lead && mood) || exp.aspects.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {lead && mood && (
              <Pill tone={toneToPill[mood.tone ?? 'neutral']}>
                {mood.emoji} {mood.label}
              </Pill>
            )}
            {exp.aspects.map((a) => (
              <Pill
                key={`${a.aspectKey}-${a.sentiment}`}
                tone={
                  a.sentiment === 'POSITIVE'
                    ? 'positive'
                    : a.sentiment === 'NEGATIVE'
                      ? 'negative'
                      : 'neutral'
                }
              >
                {a.label}
              </Pill>
            ))}
          </div>
        )}

        <div className="hairline mt-3" aria-hidden />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[0.8125rem] text-muted-foreground">
            <span className="truncate font-medium text-label">{exp.authorName ?? 'Besitzer'}</span>
            {exp.verificationStatus === 'VERIFIED' && (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-positive-ink"
                strokeWidth={2.4}
                aria-label="Echter Käufer"
              />
            )}
          </span>
          {buy && (
            <Pill tone={toneToPill[buy.tone ?? 'neutral']} className="shrink-0">
              {buy.emoji} {buy.label}
            </Pill>
          )}
        </div>
      </div>
    </motion.li>
  );
}

/**
 * The owner journey as a premium vertical timeline — "von Kauf bis Urteil". Each
 * experience is a verdict node (colored thumb) on a rail that draws itself as you
 * scroll; the bold marker says how long after buying the owner judged it. Newest
 * first; the newest node gently pulses. A long history collapses its older tail
 * into a one-line summary that expands on tap.
 */
export function ExperienceTimeline({ experiences }: { experiences: ExperienceDto[] }) {
  const reduced = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...experiences].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [experiences],
  );

  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start 0.8', 'end 0.5'],
  });
  const drawn = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.4 });

  if (sorted.length === 0) return null;

  const shown = expanded ? sorted : sorted.slice(0, INITIAL);
  const hidden = sorted.slice(shown.length);
  const restCount = hidden.length;
  const restYes = hidden.filter((e) => e.wouldBuyAgain === 'YES').length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 px-1">
        <History className="h-4 w-4 shrink-0 text-accent-ink" strokeWidth={2.2} aria-hidden />
        <p className="text-[0.9375rem] leading-snug text-muted-foreground">
          Die <span className="font-semibold text-label">Besitzer-Reise</span> — von Kauf bis Urteil,
          neueste zuerst.
        </p>
      </div>

      <div ref={railRef} className="relative">
        {/* Rail track + scroll-drawn progress line. */}
        <span
          aria-hidden
          className="absolute bottom-3 left-5 top-3 w-[2px] -translate-x-1/2 rounded-full bg-separator"
        />
        {!reduced && (
          <motion.span
            aria-hidden
            className="absolute bottom-3 left-5 top-3 w-[2px] -translate-x-1/2 origin-top rounded-full bg-accent"
            style={{ scaleY: drawn }}
          />
        )}

        <ol className="relative space-y-6">
          {shown.map((exp, i) => (
            <TimelineNode key={exp.id} exp={exp} newest={i === 0} />
          ))}

          {restCount > 0 && (
            <li className="relative pl-14">
              <span
                aria-hidden
                className="absolute left-5 top-0.5 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full bg-surface-muted text-faint"
                style={{ boxShadow: '0 0 0 4px var(--color-canvas)' }}
              >
                <span className="text-[0.7rem] font-bold">+{restCount}</span>
              </span>
              <button
                onClick={() => {
                  navigator.vibrate?.(5);
                  setExpanded(true);
                }}
                className="tap-dim pt-0.5 text-left"
              >
                <p className="text-[0.9375rem] font-semibold text-label">
                  {restCount} weitere {restCount === 1 ? 'Erfahrung' : 'Erfahrungen'} davor
                </p>
                <p className="font-mono mt-0.5 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                  {restYes} davon „wieder kaufen" · tippen zum Aufklappen
                </p>
              </button>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
