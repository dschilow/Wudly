'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import type { ExperienceDto } from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  EXPERIENCE_MOOD_OPTIONS,
  USAGE_DURATION_LABEL,
} from '@wudly/shared';
import { BadgeCheck } from 'lucide-react';
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

const DOT_COLOR: Record<string, string> = {
  YES: 'var(--color-positive)',
  NO: 'var(--color-regret)',
  UNSURE: 'var(--color-unsure)',
};

/** How many nodes to show before collapsing the older tail into a summary. */
const INITIAL = 6;

function TimelineNode({ exp }: { exp: ExperienceDto }) {
  const reduced = useReducedMotion();
  const buy = buyAgainMap[exp.wouldBuyAgain];
  const mood = moodMap[exp.experienceMood];
  const lead = exp.freeText ?? exp.wishKnownText;
  const color = DOT_COLOR[exp.wouldBuyAgain] ?? 'var(--color-faint)';

  return (
    <motion.li
      className="relative pl-11"
      initial={reduced ? false : { opacity: 0, x: 14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      {/* Node dot — punches through the rail with a canvas ring. */}
      <span
        aria-hidden
        className="absolute left-[1.07rem] top-0.5 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-canvas"
      >
        <span
          className="h-3 w-3 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 16%, transparent)`,
          }}
        />
      </span>

      <p className="mono-data text-[0.6875rem] uppercase tracking-[0.14em] text-faint">
        {USAGE_DURATION_LABEL[exp.usageDuration]} · {formatDate(exp.createdAt)}
      </p>

      <div className="card mt-1.5 p-3.5">
        {lead ? (
          <p className="text-[1rem] leading-snug text-label">{lead}</p>
        ) : mood ? (
          <p className="text-[1rem] leading-snug text-label">
            {mood.emoji} {mood.label}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[0.75rem] text-muted-foreground">
            <span className="truncate">{exp.authorName ?? 'Besitzer'}</span>
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
 * The owner journey as a fancy vertical timeline: each experience is a node on a
 * rail that "draws" itself as you scroll (scroll-linked scaleY), with nodes
 * springing in. Newest first. When there are many, the older tail collapses into
 * a one-line summary that expands on tap — so a long history stays scannable.
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
    offset: ['start 0.85', 'end 0.45'],
  });
  const drawn = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  if (sorted.length === 0) return null;

  const shown = expanded ? sorted : sorted.slice(0, INITIAL);
  const hidden = sorted.slice(shown.length);
  const restCount = hidden.length;
  const restYes = hidden.filter((e) => e.wouldBuyAgain === 'YES').length;

  return (
    <div ref={railRef} className="relative">
      {/* Rail track + scroll-drawn progress line. */}
      <span
        aria-hidden
        className="absolute bottom-2 left-[1.07rem] top-2 w-px -translate-x-1/2 bg-separator"
      />
      {!reduced && (
        <motion.span
          aria-hidden
          className="absolute bottom-2 left-[1.07rem] top-2 w-px -translate-x-1/2 origin-top bg-accent"
          style={{ scaleY: drawn }}
        />
      )}

      <ol className="relative space-y-5">
        {shown.map((exp) => (
          <TimelineNode key={exp.id} exp={exp} />
        ))}

        {/* Summary of the collapsed older tail. */}
        {restCount > 0 && (
          <li className="relative pl-11">
            <span
              aria-hidden
              className="absolute left-[1.07rem] top-1 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-canvas"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-faint" />
            </span>
            <button
              onClick={() => {
                navigator.vibrate?.(5);
                setExpanded(true);
              }}
              className="tap-dim text-left"
            >
              <p className="text-[0.9375rem] font-semibold text-label">
                + {restCount} weitere {restCount === 1 ? 'Erfahrung' : 'Erfahrungen'} davor
              </p>
              <p className="mono-data mt-0.5 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                {restYes} davon „wieder kaufen" · tippen zum Aufklappen
              </p>
            </button>
          </li>
        )}
      </ol>
    </div>
  );
}
