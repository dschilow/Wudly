/**
 * Ownership companion ("Besitz-Begleiter") — the pure timing model behind
 * Wudly's long-term check-ins.
 *
 * Wudly's data is only honest if owners come back after the honeymoon. The
 * companion turns one verdict into a journey: a first impression, then short
 * check-ins after 1 month, 6 months, 1 year and 2 years of real use. Everything
 * here is a pure function over plain inputs, so reminder scheduling (API), the
 * owner hub and the check-in wizard (web) all agree on what is due and when.
 *
 * Time runs from the estimated *start of use*, not from the moment a product was
 * added to Wudly: an owner who answers "Mehr als 1 Jahr" on day one is already a
 * year into the journey. The estimate is deliberately conservative (the lower
 * bound of each usage bucket), so a pre-selected duration never claims more use —
 * and therefore more score weight — than the owner actually reported.
 */

import { UsageDuration } from './enums';
import type {
  ExperienceMood as ExperienceMoodType,
  UsageDuration as UsageDurationType,
  WouldBuyAgain as WouldBuyAgainType,
} from './enums';
import { REBUY_VALUE, USAGE_DURATION_WEIGHT } from './scoring';

const DAY_MS = 86_400_000;

export const CheckInMilestone = {
  FIRST: 'FIRST',
  MONTH_1: 'MONTH_1',
  MONTH_6: 'MONTH_6',
  YEAR_1: 'YEAR_1',
  YEAR_2: 'YEAR_2',
} as const;
export type CheckInMilestone = (typeof CheckInMilestone)[keyof typeof CheckInMilestone];

export interface CheckInMilestoneDef {
  key: CheckInMilestone;
  /** Short track label ("6 Monate"). */
  label: string;
  /** Name of the check-in itself ("6-Monats-Check"). */
  checkLabel: string;
  /** Headline of the moment ("Nach der Euphorie"). */
  title: string;
  /** One calm line on why this moment matters. */
  purpose: string;
  /** Days of use after which the check-in is due. */
  dueAfterDays: number;
  /** A check-in from this many days of use on counts for the milestone. */
  windowStartDays: number;
}

/** The journey, in order. Each window runs until the next milestone's window starts. */
export const CHECK_IN_MILESTONES: readonly CheckInMilestoneDef[] = [
  {
    key: CheckInMilestone.FIRST,
    label: 'Start',
    checkLabel: 'Erster Eindruck',
    title: 'Erster Eindruck',
    purpose: 'Dein Bauchgefühl nach den ersten Tagen.',
    dueAfterDays: 0,
    windowStartDays: 0,
  },
  {
    key: CheckInMilestone.MONTH_1,
    label: '1 Monat',
    checkLabel: '1-Monats-Check',
    title: 'Der Alltagstest',
    purpose: 'Nach ein paar Wochen zeigt sich, was im Alltag wirklich nervt.',
    dueAfterDays: 30,
    windowStartDays: 21,
  },
  {
    key: CheckInMilestone.MONTH_6,
    label: '6 Monate',
    checkLabel: '6-Monats-Check',
    title: 'Nach der Euphorie',
    purpose: 'Die Anfangsbegeisterung ist verflogen – jetzt zählt die ehrliche Bilanz.',
    dueAfterDays: 182,
    windowStartDays: 150,
  },
  {
    key: CheckInMilestone.YEAR_1,
    label: '1 Jahr',
    checkLabel: 'Jahres-Check',
    title: 'Das Langzeit-Urteil',
    purpose: 'Ein Jahr echte Nutzung – das stärkste Signal für andere Käufer.',
    dueAfterDays: 365,
    windowStartDays: 320,
  },
  {
    key: CheckInMilestone.YEAR_2,
    label: '2 Jahre',
    checkLabel: '2-Jahres-Check',
    title: 'Der Dauertest',
    purpose: 'Hält es, was es versprochen hat? Jetzt zeigt sich die Haltbarkeit.',
    dueAfterDays: 730,
    windowStartDays: 660,
  },
];

export const CHECK_IN_MILESTONE_BY_KEY = Object.fromEntries(
  CHECK_IN_MILESTONES.map((milestone) => [milestone.key, milestone]),
) as Record<CheckInMilestone, CheckInMilestoneDef>;

/** Wait this long before nudging someone who registered a product without a verdict. */
export const FIRST_VERDICT_NUDGE_DAYS = 3;
/** A milestone never comes due sooner than this after the previous check-in. */
export const MIN_DAYS_BETWEEN_CHECK_INS = 30;
/** How far "Später erinnern" postpones a due check-in. */
export const CHECK_IN_SNOOZE_DAYS = 14;

/** Conservative lower bound (in days) of each usage bucket. */
export const USAGE_DURATION_MIN_DAYS: Record<UsageDurationType, number> = {
  [UsageDuration.LESS_THAN_WEEK]: 0,
  [UsageDuration.ONE_TO_FOUR_WEEKS]: 7,
  [UsageDuration.ONE_TO_SIX_MONTHS]: 30,
  [UsageDuration.SIX_TO_TWELVE_MONTHS]: 182,
  [UsageDuration.MORE_THAN_YEAR]: 365,
};

const USAGE_ORDER: readonly UsageDurationType[] = [
  UsageDuration.LESS_THAN_WEEK,
  UsageDuration.ONE_TO_FOUR_WEEKS,
  UsageDuration.ONE_TO_SIX_MONTHS,
  UsageDuration.SIX_TO_TWELVE_MONTHS,
  UsageDuration.MORE_THAN_YEAR,
];

/** The usage bucket a number of days of use falls into. */
export function usageDurationForDays(days: number): UsageDurationType {
  for (let i = USAGE_ORDER.length - 1; i > 0; i--) {
    const bucket = USAGE_ORDER[i]!;
    if (days >= USAGE_DURATION_MIN_DAYS[bucket]) return bucket;
  }
  return UsageDuration.LESS_THAN_WEEK;
}

/** Negative when `a` is a shorter usage bucket than `b`, positive when longer. */
export function compareUsageDuration(a: UsageDurationType, b: UsageDurationType): number {
  return USAGE_ORDER.indexOf(a) - USAGE_ORDER.indexOf(b);
}

/** One recorded verdict (an experience checkpoint) as input to the journey. */
export interface CompanionCheckInInput {
  at: Date | string;
  wouldBuyAgain: WouldBuyAgainType;
  usageDuration: UsageDurationType;
  experienceMood: ExperienceMoodType;
}

export interface JourneyCheckIn {
  at: string;
  wouldBuyAgain: WouldBuyAgainType;
  usageDuration: UsageDurationType;
  experienceMood: ExperienceMoodType;
  /** Estimated days of use when the check-in was made. */
  ageDays: number;
  /** The milestone window the check-in landed in. */
  milestone: CheckInMilestone;
}

/**
 * - `done`     a check-in landed in this milestone's window
 * - `due`      the current window: check-in time reached, nothing recorded yet
 * - `upcoming` still ahead
 * - `missed`   the window passed on Wudly without a check-in
 * - `before`   the window passed before the product was added to Wudly
 * - `closed`   the owner stopped using the product before it came up
 */
export type CheckInMilestoneState = 'done' | 'due' | 'upcoming' | 'missed' | 'before' | 'closed';

export interface JourneyMilestone {
  key: CheckInMilestone;
  label: string;
  checkLabel: string;
  title: string;
  purpose: string;
  /** When the check-in is (or was) due. */
  dueAt: string;
  state: CheckInMilestoneState;
  /** Latest check-in within the window, if any. */
  checkIn: JourneyCheckIn | null;
}

export type VerdictTrend = 'up' | 'down' | 'same';

export interface CheckInJourney {
  /** Estimated (conservative) start of use. */
  startedAt: string;
  /** Days of use so far — up to the end date for finished ownerships. */
  ageDays: number;
  milestones: JourneyMilestone[];
  due: JourneyMilestone | null;
  next: JourneyMilestone | null;
  /** Newest first. */
  checkIns: JourneyCheckIn[];
  latest: JourneyCheckIn | null;
  first: JourneyCheckIn | null;
  /** How the verdict moved from the first to the latest check-in (null below two). */
  trend: VerdictTrend | null;
  /** Usage bucket to pre-select for a check-in today — never below the last one. */
  suggestedUsageDuration: UsageDurationType;
  /** Score weight of the latest verdict; null without any verdict. */
  currentWeight: number | null;
  /** Score weight the verdict carries after a check-in today. */
  checkInWeight: number;
  /** Check-ins made vs. milestones the owner could have answered on Wudly. */
  progress: { done: number; total: number };
}

export interface BuildJourneyInput {
  /** Stored start-of-use estimate (null on legacy rows). */
  ownedSince?: Date | string | null;
  /** When the product was registered on Wudly. */
  ownershipCreatedAt: Date | string;
  checkIns: readonly CompanionCheckInInput[];
  /** Set once the owner stopped using the product. */
  endedAt?: Date | string | null;
  now?: Date;
}

function toMs(value: Date | string): number {
  return typeof value === 'string' ? Date.parse(value) : value.getTime();
}

function wholeDays(fromMs: number, toMsValue: number): number {
  return Math.max(0, Math.floor((toMsValue - fromMs) / DAY_MS));
}

/**
 * The latest plausible start of use: never after the product was registered, and
 * never after what any check-in implies ("1 bis 6 Monate" ⇒ at least 30 days ago).
 */
export function estimateStartOfUse(input: {
  ownedSince?: Date | string | null;
  ownershipCreatedAt: Date | string;
  checkIns: ReadonlyArray<{ at: Date | string; usageDuration: UsageDurationType }>;
}): Date {
  let start = toMs(input.ownershipCreatedAt);
  if (input.ownedSince) start = Math.min(start, toMs(input.ownedSince));
  for (const checkIn of input.checkIns) {
    start = Math.min(
      start,
      toMs(checkIn.at) - USAGE_DURATION_MIN_DAYS[checkIn.usageDuration] * DAY_MS,
    );
  }
  return new Date(start);
}

/** Assembles the owner's journey: which check-ins happened, what is due, what's next. */
export function buildCheckInJourney(input: BuildJourneyInput): CheckInJourney {
  const nowMs = (input.now ?? new Date()).getTime();
  const createdMs = toMs(input.ownershipCreatedAt);
  const endedMs = input.endedAt ? toMs(input.endedAt) : null;
  // A finished ownership freezes the journey at its end.
  const refMs = endedMs !== null ? Math.min(nowMs, endedMs) : nowMs;
  const startMs = estimateStartOfUse(input).getTime();

  const windowIndexFor = (ageDays: number): number => {
    let index = 0;
    CHECK_IN_MILESTONES.forEach((milestone, i) => {
      if (ageDays >= milestone.windowStartDays) index = i;
    });
    return index;
  };

  const ascending: JourneyCheckIn[] = [...input.checkIns]
    .sort((a, b) => toMs(a.at) - toMs(b.at))
    .map((checkIn) => {
      const atMs = toMs(checkIn.at);
      const ageDays = wholeDays(startMs, atMs);
      return {
        at: new Date(atMs).toISOString(),
        wouldBuyAgain: checkIn.wouldBuyAgain,
        usageDuration: checkIn.usageDuration,
        experienceMood: checkIn.experienceMood,
        ageDays,
        milestone: CHECK_IN_MILESTONES[windowIndexFor(ageDays)]!.key,
      };
    });

  // Later check-ins in the same window win: the milestone shows the latest word.
  const byMilestone = new Map<CheckInMilestone, JourneyCheckIn>();
  for (const checkIn of ascending) byMilestone.set(checkIn.milestone, checkIn);

  const first = ascending[0] ?? null;
  const latest = ascending[ascending.length - 1] ?? null;
  const latestMs = latest ? toMs(latest.at) : null;

  const milestones: JourneyMilestone[] = CHECK_IN_MILESTONES.map((def, i) => {
    const following = CHECK_IN_MILESTONES[i + 1];
    const windowStartMs = startMs + def.windowStartDays * DAY_MS;
    const windowEndMs = following
      ? startMs + following.windowStartDays * DAY_MS
      : Number.POSITIVE_INFINITY;
    // Open windows never come due right after a check-in; past ones keep their date.
    const dueMs =
      windowEndMs > refMs && latestMs !== null
        ? Math.max(
            startMs + def.dueAfterDays * DAY_MS,
            latestMs + MIN_DAYS_BETWEEN_CHECK_INS * DAY_MS,
          )
        : startMs + def.dueAfterDays * DAY_MS;
    const checkIn = byMilestone.get(def.key) ?? null;

    let state: CheckInMilestoneState;
    if (checkIn) state = 'done';
    else if (windowEndMs <= createdMs) state = 'before';
    else if (windowEndMs <= refMs) state = 'missed';
    else if (endedMs !== null) state = 'closed';
    else if (refMs >= windowStartMs) {
      // Without any verdict yet the current window is always due: the first
      // word is the one Wudly is missing most.
      state = !latest || refMs >= dueMs ? 'due' : 'upcoming';
    } else state = 'upcoming';

    return {
      key: def.key,
      label: def.label,
      checkLabel: def.checkLabel,
      title: def.title,
      purpose: def.purpose,
      dueAt: new Date(dueMs).toISOString(),
      state,
      checkIn,
    };
  });

  const ageDays = wholeDays(startMs, refMs);
  const ageBucket = usageDurationForDays(ageDays);
  const suggestedUsageDuration =
    latest && compareUsageDuration(latest.usageDuration, ageBucket) > 0
      ? latest.usageDuration
      : ageBucket;

  let trend: VerdictTrend | null = null;
  if (first && latest && ascending.length >= 2) {
    const delta = REBUY_VALUE[latest.wouldBuyAgain] - REBUY_VALUE[first.wouldBuyAgain];
    trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  }

  const counted = milestones.filter((m) => m.state !== 'before' && m.state !== 'closed');

  return {
    startedAt: new Date(startMs).toISOString(),
    ageDays,
    milestones,
    due: milestones.find((m) => m.state === 'due') ?? null,
    next: milestones.find((m) => m.state === 'upcoming') ?? null,
    checkIns: [...ascending].reverse(),
    latest,
    first,
    trend,
    suggestedUsageDuration,
    currentWeight: latest ? USAGE_DURATION_WEIGHT[latest.usageDuration] : null,
    checkInWeight: USAGE_DURATION_WEIGHT[suggestedUsageDuration],
    progress: {
      done: counted.filter((m) => m.state === 'done').length,
      total: counted.length,
    },
  };
}

export interface ReminderScheduleInput {
  ownershipCreatedAt: Date | string;
  /** When the last check-in reminder went out. */
  lastReminderAt?: Date | string | null;
  /** "Später erinnern": re-nudge the due check-in from this moment on. */
  snoozedUntil?: Date | string | null;
  muted?: boolean;
  ended?: boolean;
}

/**
 * When the next check-in reminder should go out, or null when none is planned.
 * One nudge per milestone: an ignored reminder is never repeated — the next
 * milestone simply follows. A snooze re-schedules the current one once.
 */
export function nextCheckInReminderAt(
  journey: CheckInJourney,
  input: ReminderScheduleInput,
): Date | null {
  if (input.muted || input.ended) return null;

  const due = journey.due;
  if (due) {
    const dueMs = toMs(due.dueAt);
    const lastMs = input.lastReminderAt ? toMs(input.lastReminderAt) : null;
    const snoozeMs = input.snoozedUntil ? toMs(input.snoozedUntil) : null;
    if (snoozeMs !== null && (lastMs === null || lastMs < snoozeMs)) {
      return new Date(Math.max(snoozeMs, dueMs));
    }
    if (lastMs === null || lastMs < dueMs) {
      const nudgeMs = toMs(input.ownershipCreatedAt) + FIRST_VERDICT_NUDGE_DAYS * DAY_MS;
      return new Date(Math.max(dueMs, nudgeMs));
    }
  }
  return journey.next ? new Date(journey.next.dueAt) : null;
}

/** "3 Monaten", "über einem Jahr" — a time span in the dative, for "seit …" / "nach …". */
export function ownershipSpan(days: number): string {
  if (days < 7) return 'wenigen Tagen';
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'einer Woche' : `${weeks} Wochen`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30.44);
    return months <= 1 ? 'einem Monat' : `${months} Monaten`;
  }
  const years = Math.floor(days / 365);
  const span = years === 1 ? 'einem Jahr' : `${years} Jahren`;
  return days - years * 365 >= 60 ? `über ${span}` : span;
}

/** "seit 3 Monaten", "seit einem Jahr" — how long the owner has had it (lower bound). */
export function ownershipAgeLabel(days: number): string {
  return `seit ${ownershipSpan(days)}`;
}

/** A check-in this much past its milestone is named by the real time of use instead. */
const ON_TIME_DAYS = 45;

/**
 * Name of the check-in that is due: "6-Monats-Check" when it comes up on time,
 * "Check-in nach 4 Monaten" when the owner is well past the milestone, and
 * "Dein erstes Urteil" while there is no verdict at all. Null when nothing is due.
 */
export function dueCheckInLabel(journey: CheckInJourney): string | null {
  const due = journey.due;
  if (!due) return null;
  if (!journey.latest) return 'Dein erstes Urteil';
  return journey.ageDays <= CHECK_IN_MILESTONE_BY_KEY[due.key].dueAfterDays + ON_TIME_DAYS
    ? due.checkLabel
    : `Check-in nach ${ownershipSpan(journey.ageDays)}`;
}
