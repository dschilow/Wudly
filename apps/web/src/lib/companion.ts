import { CircleHelp, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react';
import {
  CHECK_IN_MILESTONES,
  type CheckInJourney,
  type CheckInMilestoneState,
  type WouldBuyAgain,
} from '@wudly/shared';

const DAY_MS = 86_400_000;

/** One look per verdict, shared by every companion surface. */
export const VERDICT_STYLE: Record<
  WouldBuyAgain,
  { short: string; long: string; icon: LucideIcon; solid: string; soft: string; ink: string }
> = {
  YES: {
    short: 'Ja',
    long: 'Würde ich wieder kaufen',
    icon: ThumbsUp,
    solid: 'bg-positive',
    soft: 'bg-positive-soft',
    ink: 'text-positive-ink',
  },
  UNSURE: {
    short: 'Unsicher',
    long: 'Bin mir unsicher',
    icon: CircleHelp,
    solid: 'bg-unsure',
    soft: 'bg-unsure-soft',
    ink: 'text-unsure-ink',
  },
  NO: {
    short: 'Nein',
    long: 'Würde ich nicht wieder kaufen',
    icon: ThumbsDown,
    solid: 'bg-regret',
    soft: 'bg-regret-soft',
    ink: 'text-regret-ink',
  },
};

export const MILESTONE_STATE_LABEL: Record<CheckInMilestoneState, string> = {
  done: 'erledigt',
  due: 'fällig',
  upcoming: 'kommt noch',
  missed: 'ausgelassen',
  before: 'vor Wudly',
  closed: 'beendet',
};

const TARGET_DAYS = CHECK_IN_MILESTONES.map((milestone) => milestone.dueAfterDays);

/**
 * Where "today" sits on the evenly spaced milestone track (0 … 1). Real time is
 * not linear across the stages (1 month vs. 2 years), so the position is
 * interpolated between the two milestones around the current age.
 */
export function trackPosition(ageDays: number): number {
  const last = TARGET_DAYS.length - 1;
  for (let i = 0; i < last; i++) {
    const from = TARGET_DAYS[i]!;
    const to = TARGET_DAYS[i + 1]!;
    if (ageDays < to) return (i + Math.max(0, ageDays - from) / (to - from)) / last;
  }
  return 1;
}

/** "in 12 Tagen", "in 4 Monaten" — time until a future date. */
export function untilLabel(iso: string, now = Date.now()): string {
  const days = Math.ceil((Date.parse(iso) - now) / DAY_MS);
  if (days <= 0) return 'jetzt';
  if (days === 1) return 'morgen';
  if (days < 14) return `in ${days} Tagen`;
  if (days < 60) return `in ${Math.round(days / 7)} Wochen`;
  if (days < 365) return `in ${Math.round(days / 30.44)} Monaten`;
  const years = Math.round(days / 365);
  return years === 1 ? 'in einem Jahr' : `in ${years} Jahren`;
}

/** "Apr. 2027" */
export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

/** "1,3×" */
export function formatWeight(weight: number): string {
  return `${weight.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;
}

/** "seit 3 Monaten" → "Seit 3 Monaten" at the start of a sentence. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Screen-reader summary of a journey track. */
export function journeyAriaLabel(journey: CheckInJourney): string {
  return `Begleitung: ${journey.milestones
    .map((milestone) => `${milestone.label} ${MILESTONE_STATE_LABEL[milestone.state]}`)
    .join(', ')}`;
}
