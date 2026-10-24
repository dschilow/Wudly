'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import type { ExperienceCheckpointDto, ExperienceDto } from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  EXPERIENCE_MOOD_OPTIONS,
  REBUY_VALUE,
  USAGE_DURATION_LABEL,
} from '@wudly/shared';
import {
  ArrowRight,
  BadgeCheck,
  History,
  Minus,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { VERDICT_STYLE } from '@/lib/companion';
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

function verificationLabel(exp: ExperienceDto) {
  if (exp.verificationMethod === 'CONTINUITY') {
    return 'Besitz durch wiederholte Langzeit-Updates plausibilisiert';
  }
  return 'Besitz zusätzlich durch Wudly geprüft';
}

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
      // Server and client must render the same markup: reduced motion only
      // changes the (unserialised) transition, never the initial styles.
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.55 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Verdict node: a colored dot with a thumb icon, punched through the rail. */}
      <span className="absolute left-5 top-0.5 -translate-x-1/2">
        {newest && (
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full motion-reduce:hidden"
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
      <p
        className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
        style={{ color }}
      >
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

        <VerdictPath checkpoints={exp.checkpoints} />

        <div className="hairline mt-3" aria-hidden />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[0.8125rem] text-muted-foreground">
            <span className="truncate font-medium text-label">{exp.authorName ?? 'Besitzer'}</span>
            {exp.verificationStatus === 'VERIFIED' && (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-positive-ink"
                strokeWidth={2.4}
                aria-label={verificationLabel(exp)}
              />
            )}
            {exp.variantName && (
              <span className="mono-data ml-1 shrink-0 rounded-full bg-fill-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
                {exp.variantName}
              </span>
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

const USAGE_SHORT: Record<string, string> = {
  LESS_THAN_WEEK: '< 1 Wo.',
  ONE_TO_FOUR_WEEKS: '1–4 Wo.',
  ONE_TO_SIX_MONTHS: '1–6 Mon.',
  SIX_TO_TWELVE_MONTHS: '6–12 Mon.',
  MORE_THAN_YEAR: '> 1 Jahr',
};

/** How one owner's verdict moved across their check-ins ("Ja → Ja → Unsicher"). */
function VerdictPath({ checkpoints = [] }: { checkpoints?: ExperienceCheckpointDto[] }) {
  if (checkpoints.length < 2) return null;
  const path = checkpoints.slice(-4);
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.75rem]">
      <span className="mono-data mr-0.5 font-semibold uppercase tracking-[0.1em] text-faint">
        Verlauf
      </span>
      {checkpoints.length > path.length && <span className="text-faint">…</span>}
      {path.map((checkpoint, i) => {
        const style = VERDICT_STYLE[checkpoint.wouldBuyAgain];
        return (
          <span key={checkpoint.at} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="h-3 w-3 text-faint" strokeWidth={2.4} aria-hidden />}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', style.solid)} aria-hidden />
              <span className="font-semibold text-label">{style.short}</span>
              <span className="text-faint">{USAGE_SHORT[checkpoint.usageDuration]}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Owners who checked in again at least a month after their first verdict. */
function verdictDrift(experiences: ExperienceDto[]) {
  let same = 0;
  let up = 0;
  let down = 0;
  for (const exp of experiences) {
    // Older API responses carry no checkpoints; treat them as a single verdict.
    const checkpoints = exp.checkpoints ?? [];
    const first = checkpoints[0];
    const last = checkpoints[checkpoints.length - 1];
    if (!first || !last || Date.parse(last.at) - Date.parse(first.at) < 30 * 86_400_000) continue;
    const delta = REBUY_VALUE[last.wouldBuyAgain] - REBUY_VALUE[first.wouldBuyAgain];
    if (delta > 0) up += 1;
    else if (delta < 0) down += 1;
    else same += 1;
  }
  return { same, up, down, total: same + up + down };
}

/**
 * "Urteil im Zeitverlauf": what happens to verdicts after the honeymoon. Wudly
 * asks owners again after months of use — whether they stayed with their
 * verdict is the most honest signal a buyer can get.
 */
function VerdictDrift({ experiences }: { experiences: ExperienceDto[] }) {
  const reduced = useReducedMotion();
  const drift = verdictDrift(experiences);
  if (drift.total === 0) return null;
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
  const segments = [
    {
      key: 'same',
      count: drift.same,
      label: plural(drift.same, 'blieb dabei', 'blieben dabei'),
      color: 'bg-accent',
    },
    {
      key: 'down',
      count: drift.down,
      label: plural(drift.down, 'wurde kritischer', 'wurden kritischer'),
      color: 'bg-regret',
    },
    {
      key: 'up',
      count: drift.up,
      label: plural(drift.up, 'wurde positiver', 'wurden positiver'),
      color: 'bg-positive',
    },
  ].filter((segment) => segment.count > 0);

  return (
    <div className="card mb-6 p-4">
      <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
        Urteil im Zeitverlauf
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-snug text-label">
        {drift.total === 1
          ? '1 Besitzer hat nach Wochen oder Monaten erneut bewertet.'
          : `${drift.total} Besitzer haben nach Wochen oder Monaten erneut bewertet.`}
      </p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-fill-2">
        {segments.map((segment, i) => (
          <motion.span
            key={segment.key}
            className={cn('h-full', segment.color)}
            initial={{ width: 0 }}
            whileInView={{ width: `${(segment.count / drift.total) * 100}%` }}
            viewport={{ once: true }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 70, damping: 18, delay: 0.1 + i * 0.12 }
            }
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', segment.color)} aria-hidden />
            <span className="font-semibold text-label">{segment.count}</span> {segment.label}
          </span>
        ))}
      </div>
    </div>
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
      <VerdictDrift experiences={sorted} />
      <div className="mb-4 flex items-center gap-2 px-1">
        <History className="h-4 w-4 shrink-0 text-accent-ink" strokeWidth={2.2} aria-hidden />
        <p className="text-[0.9375rem] leading-snug text-muted-foreground">
          Die <span className="font-semibold text-label">Besitzer-Reise</span> — von Kauf bis
          Urteil, neueste zuerst.
        </p>
      </div>

      <div ref={railRef} className="relative">
        {/* Rail track + scroll-drawn progress line. */}
        <span
          aria-hidden
          className="absolute bottom-3 left-5 top-3 w-[2px] -translate-x-1/2 rounded-full bg-separator"
        />
        <motion.span
          aria-hidden
          className="absolute bottom-3 left-5 top-3 w-[2px] -translate-x-1/2 origin-top rounded-full bg-accent motion-reduce:hidden"
          style={{ scaleY: drawn }}
        />

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
