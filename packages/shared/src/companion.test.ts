import { describe, expect, it } from 'vitest';
import {
  buildCheckInJourney,
  CHECK_IN_SNOOZE_DAYS,
  dueCheckInLabel,
  estimateStartOfUse,
  FIRST_VERDICT_NUDGE_DAYS,
  nextCheckInReminderAt,
  ownershipAgeLabel,
  usageDurationForDays,
  type CompanionCheckInInput,
} from './companion';
import { ExperienceMood, UsageDuration, WouldBuyAgain } from './enums';

const DAY = 86_400_000;
const T0 = new Date('2026-01-01T12:00:00.000Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

function checkIn(
  days: number,
  usageDuration: CompanionCheckInInput['usageDuration'],
  wouldBuyAgain: CompanionCheckInInput['wouldBuyAgain'] = WouldBuyAgain.YES,
): CompanionCheckInInput {
  return {
    at: at(days),
    usageDuration,
    wouldBuyAgain,
    experienceMood: ExperienceMood.GOOD_DAILY_USE,
  };
}

const states = (journey: ReturnType<typeof buildCheckInJourney>) =>
  journey.milestones.map((m) => `${m.key}:${m.state}`);

describe('usageDurationForDays', () => {
  it('maps days of use onto the lower bound of each bucket', () => {
    expect(usageDurationForDays(0)).toBe(UsageDuration.LESS_THAN_WEEK);
    expect(usageDurationForDays(6)).toBe(UsageDuration.LESS_THAN_WEEK);
    expect(usageDurationForDays(7)).toBe(UsageDuration.ONE_TO_FOUR_WEEKS);
    expect(usageDurationForDays(29)).toBe(UsageDuration.ONE_TO_FOUR_WEEKS);
    expect(usageDurationForDays(30)).toBe(UsageDuration.ONE_TO_SIX_MONTHS);
    expect(usageDurationForDays(182)).toBe(UsageDuration.SIX_TO_TWELVE_MONTHS);
    expect(usageDurationForDays(365)).toBe(UsageDuration.MORE_THAN_YEAR);
    expect(usageDurationForDays(2000)).toBe(UsageDuration.MORE_THAN_YEAR);
  });
});

describe('estimateStartOfUse', () => {
  it('never lies after registration and honours what each check-in implies', () => {
    expect(estimateStartOfUse({ ownershipCreatedAt: T0, checkIns: [] }).toISOString()).toBe(
      T0.toISOString(),
    );
    const start = estimateStartOfUse({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.ONE_TO_SIX_MONTHS)],
    });
    expect(start.toISOString()).toBe(at(-30).toISOString());
  });

  it('keeps the earliest implied start (it can only move back in time)', () => {
    const start = estimateStartOfUse({
      ownedSince: at(-10),
      ownershipCreatedAt: T0,
      checkIns: [
        checkIn(0, UsageDuration.ONE_TO_FOUR_WEEKS),
        checkIn(60, UsageDuration.ONE_TO_SIX_MONTHS),
      ],
    });
    expect(start.toISOString()).toBe(at(-10).toISOString());
  });
});

describe('buildCheckInJourney', () => {
  it('starts a fresh owner at the first impression with the 1-month check ahead', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.LESS_THAN_WEEK)],
      now: at(1),
    });
    expect(states(journey)).toEqual([
      'FIRST:done',
      'MONTH_1:upcoming',
      'MONTH_6:upcoming',
      'YEAR_1:upcoming',
      'YEAR_2:upcoming',
    ]);
    expect(journey.due).toBeNull();
    expect(journey.next?.key).toBe('MONTH_1');
    expect(journey.next?.dueAt).toBe(at(30).toISOString());
    expect(journey.progress).toEqual({ done: 1, total: 5 });
    expect(journey.trend).toBeNull();
  });

  it('makes the 1-month check due and suggests the longer, heavier usage bucket', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.LESS_THAN_WEEK)],
      now: at(35),
    });
    expect(journey.due?.key).toBe('MONTH_1');
    expect(journey.next?.key).toBe('MONTH_6');
    expect(journey.suggestedUsageDuration).toBe(UsageDuration.ONE_TO_SIX_MONTHS);
    expect(journey.currentWeight).toBe(0.5);
    expect(journey.checkInWeight).toBe(1);
  });

  it('places a long-time owner mid-journey and marks earlier stages as before Wudly', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.MORE_THAN_YEAR)],
      now: at(2),
    });
    expect(states(journey)).toEqual([
      'FIRST:before',
      'MONTH_1:before',
      'MONTH_6:before',
      'YEAR_1:done',
      'YEAR_2:upcoming',
    ]);
    expect(journey.startedAt).toBe(at(-365).toISOString());
    expect(journey.next?.dueAt).toBe(at(365).toISOString());
    expect(journey.progress).toEqual({ done: 1, total: 2 });
    // Past stages keep their own date (for the timeline), not a check-in gap.
    expect(journey.milestones[1]!.dueAt).toBe(at(-335).toISOString());
  });

  it('keeps the first verdict due for owners who never gave one', () => {
    const fresh = buildCheckInJourney({ ownershipCreatedAt: T0, checkIns: [], now: at(0) });
    expect(fresh.due?.key).toBe('FIRST');
    expect(fresh.latest).toBeNull();
    expect(fresh.currentWeight).toBeNull();

    // Between the windows nothing would be due for a rated product — an unrated
    // one still owes its very first word.
    const later = buildCheckInJourney({ ownershipCreatedAt: T0, checkIns: [], now: at(25) });
    expect(later.due?.key).toBe('MONTH_1');
    expect(later.due?.dueAt).toBe(at(30).toISOString());

    const muchLater = buildCheckInJourney({ ownershipCreatedAt: T0, checkIns: [], now: at(200) });
    expect(states(muchLater).slice(0, 3)).toEqual(['FIRST:missed', 'MONTH_1:missed', 'MONTH_6:due']);
  });

  it('never makes a milestone due right after a check-in', () => {
    // First impression after a week of use (day 0 = 7 days in) …
    const base = { ownershipCreatedAt: T0, checkIns: [checkIn(0, UsageDuration.ONE_TO_FOUR_WEEKS)] };
    // … 25 days later the 1-month window is open but the check-in was too recent.
    const tooSoon = buildCheckInJourney({ ...base, now: at(25) });
    expect(tooSoon.due).toBeNull();
    expect(tooSoon.next?.key).toBe('MONTH_1');
    expect(tooSoon.next?.dueAt).toBe(at(30).toISOString());
    expect(buildCheckInJourney({ ...base, now: at(31) }).due?.key).toBe('MONTH_1');
  });

  it('assigns each check-in to its window and keeps the latest per window', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [
        checkIn(0, UsageDuration.LESS_THAN_WEEK),
        checkIn(40, UsageDuration.ONE_TO_SIX_MONTHS, WouldBuyAgain.UNSURE),
        checkIn(190, UsageDuration.SIX_TO_TWELVE_MONTHS, WouldBuyAgain.NO),
      ],
      now: at(200),
    });
    expect(states(journey)).toEqual([
      'FIRST:done',
      'MONTH_1:done',
      'MONTH_6:done',
      'YEAR_1:upcoming',
      'YEAR_2:upcoming',
    ]);
    expect(journey.checkIns.map((c) => c.milestone)).toEqual(['MONTH_6', 'MONTH_1', 'FIRST']);
    expect(journey.trend).toBe('down');
    expect(journey.latest?.wouldBuyAgain).toBe(WouldBuyAgain.NO);
  });

  it('reports the verdict trend between the first and the latest check-in', () => {
    const trendOf = (from: WouldBuyAgain, to: WouldBuyAgain) =>
      buildCheckInJourney({
        ownershipCreatedAt: T0,
        checkIns: [
          checkIn(0, UsageDuration.LESS_THAN_WEEK, from),
          checkIn(40, UsageDuration.ONE_TO_SIX_MONTHS, to),
        ],
        now: at(41),
      }).trend;
    expect(trendOf(WouldBuyAgain.NO, WouldBuyAgain.YES)).toBe('up');
    expect(trendOf(WouldBuyAgain.YES, WouldBuyAgain.UNSURE)).toBe('down');
    expect(trendOf(WouldBuyAgain.YES, WouldBuyAgain.YES)).toBe('same');
  });

  it('closes the journey when the owner stopped using the product', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.LESS_THAN_WEEK)],
      endedAt: at(100),
      now: at(400),
    });
    expect(states(journey)).toEqual([
      'FIRST:done',
      'MONTH_1:closed',
      'MONTH_6:closed',
      'YEAR_1:closed',
      'YEAR_2:closed',
    ]);
    expect(journey.due).toBeNull();
    expect(journey.next).toBeNull();
    expect(journey.ageDays).toBe(100);
  });
});

describe('nextCheckInReminderAt', () => {
  const unrated = (now: Date) => buildCheckInJourney({ ownershipCreatedAt: T0, checkIns: [], now });

  it('nudges an owner without a verdict a few days after registering', () => {
    const next = nextCheckInReminderAt(unrated(at(0)), { ownershipCreatedAt: T0 });
    expect(next?.toISOString()).toBe(at(FIRST_VERDICT_NUDGE_DAYS).toISOString());
  });

  it('sends one reminder per milestone, then waits for the next one', () => {
    const next = nextCheckInReminderAt(unrated(at(4)), {
      ownershipCreatedAt: T0,
      lastReminderAt: at(3),
    });
    expect(next?.toISOString()).toBe(at(30).toISOString());
  });

  it('reminds right away when a milestone is due and nobody was nudged yet', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.LESS_THAN_WEEK)],
      now: at(200),
    });
    expect(journey.due?.key).toBe('MONTH_6');
    const next = nextCheckInReminderAt(journey, { ownershipCreatedAt: T0 });
    expect(next!.getTime()).toBeLessThanOrEqual(at(200).getTime());
  });

  it('re-schedules a snoozed check-in exactly once', () => {
    const journey = buildCheckInJourney({
      ownershipCreatedAt: T0,
      checkIns: [checkIn(0, UsageDuration.LESS_THAN_WEEK)],
      now: at(190),
    });
    const snoozedUntil = at(190 + CHECK_IN_SNOOZE_DAYS);
    const base = { ownershipCreatedAt: T0, lastReminderAt: at(183), snoozedUntil };
    expect(nextCheckInReminderAt(journey, base)?.toISOString()).toBe(snoozedUntil.toISOString());
    // After the snoozed reminder went out, the next milestone takes over.
    const afterSnooze = nextCheckInReminderAt(journey, { ...base, lastReminderAt: snoozedUntil });
    expect(afterSnooze?.toISOString()).toBe(journey.next?.dueAt);
  });

  it('plans nothing for muted or finished ownerships', () => {
    const journey = unrated(at(10));
    expect(nextCheckInReminderAt(journey, { ownershipCreatedAt: T0, muted: true })).toBeNull();
    expect(nextCheckInReminderAt(journey, { ownershipCreatedAt: T0, ended: true })).toBeNull();
  });
});

describe('dueCheckInLabel', () => {
  const journeyAt = (days: number, checkIns: CompanionCheckInInput[]) =>
    buildCheckInJourney({ ownershipCreatedAt: T0, checkIns, now: at(days) });

  it('names the milestone when the check-in comes up on time', () => {
    expect(dueCheckInLabel(journeyAt(190, [checkIn(0, UsageDuration.LESS_THAN_WEEK)]))).toBe(
      '6-Monats-Check',
    );
  });

  it('names the real time of use when the owner is well past the milestone', () => {
    expect(dueCheckInLabel(journeyAt(125, [checkIn(0, UsageDuration.LESS_THAN_WEEK)]))).toBe(
      'Check-in nach 4 Monaten',
    );
  });

  it('asks for the first verdict, and is null when nothing is due', () => {
    expect(dueCheckInLabel(journeyAt(10, []))).toBe('Dein erstes Urteil');
    expect(dueCheckInLabel(journeyAt(5, [checkIn(0, UsageDuration.LESS_THAN_WEEK)]))).toBeNull();
  });
});

describe('ownershipAgeLabel', () => {
  it('phrases the time of use in natural German', () => {
    expect(ownershipAgeLabel(3)).toBe('seit wenigen Tagen');
    expect(ownershipAgeLabel(8)).toBe('seit einer Woche');
    expect(ownershipAgeLabel(20)).toBe('seit 2 Wochen');
    expect(ownershipAgeLabel(45)).toBe('seit einem Monat');
    expect(ownershipAgeLabel(100)).toBe('seit 3 Monaten');
    expect(ownershipAgeLabel(370)).toBe('seit einem Jahr');
    expect(ownershipAgeLabel(450)).toBe('seit über einem Jahr');
    expect(ownershipAgeLabel(745)).toBe('seit 2 Jahren');
    expect(ownershipAgeLabel(800)).toBe('seit über 2 Jahren');
  });
});
