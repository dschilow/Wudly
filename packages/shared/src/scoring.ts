/**
 * Pure, dependency-free scoring logic for Wudly.
 *
 * Lives in `@wudly/shared` so the backend (snapshot generation) and the frontend
 * (score explanations / optimistic UI) share one source of truth. No I/O here —
 * everything is a pure function over plain inputs, which keeps it trivially testable.
 */

import { UsageDuration, WouldBuyAgain, ExperienceMood } from './enums';
import type {
  UsageDuration as UsageDurationType,
  WouldBuyAgain as WouldBuyAgainType,
  ExperienceMood as ExperienceMoodType,
} from './enums';

/**
 * Weight a usage duration carries when aggregating scores.
 * Longer real-world usage is more trustworthy than first-week impressions.
 */
export const USAGE_DURATION_WEIGHT: Record<UsageDurationType, number> = {
  [UsageDuration.LESS_THAN_WEEK]: 0.5,
  [UsageDuration.ONE_TO_FOUR_WEEKS]: 0.7,
  [UsageDuration.ONE_TO_SIX_MONTHS]: 1.0,
  [UsageDuration.SIX_TO_TWELVE_MONTHS]: 1.3,
  [UsageDuration.MORE_THAN_YEAR]: 1.5,
};

/**
 * How much each "would buy again" answer contributes to the rebuy score,
 * on a 0..1 scale (before duration weighting).
 */
export const REBUY_VALUE: Record<WouldBuyAgainType, number> = {
  [WouldBuyAgain.YES]: 1.0,
  [WouldBuyAgain.UNSURE]: 0.5,
  [WouldBuyAgain.NO]: 0.0,
};

/** Moods that strongly indicate regret, used to amplify the regret score. */
export const REGRET_MOODS: ReadonlySet<ExperienceMoodType> = new Set<ExperienceMoodType>([
  ExperienceMood.REGRET,
  ExperienceMood.DEFECTIVE,
]);

/** Minimal shape needed from an experience report to score it. */
export interface ScorableExperience {
  wouldBuyAgain: WouldBuyAgainType;
  usageDuration: UsageDurationType;
  experienceMood: ExperienceMoodType;
}

export interface ScoreResult {
  /** 0..100 rounded. Null when there is not enough data. */
  rebuyScore: number | null;
  /** 0..100 rounded. Null when there is not enough data. */
  regretScore: number | null;
  /** 0..100 rounded — share of "unsure" answers (duration-weighted). */
  unsureScore: number | null;
  /** Number of experiences that went into the score. */
  experienceCount: number;
}

/**
 * Compute rebuy / regret / unsure scores from a list of experiences.
 *
 * - Rebuy: duration-weighted mean of REBUY_VALUE, scaled to 0..100.
 * - Regret: duration-weighted share of "NO" answers, boosted when the mood is a
 *   regret mood (REGRET / DEFECTIVE). Capped at 100.
 * - Unsure: duration-weighted share of "UNSURE" answers, scaled to 0..100.
 *
 * Returns nulls when there are no experiences (so the UI can show an empty state
 * instead of a misleading 0).
 */
export function computeScores(experiences: readonly ScorableExperience[]): ScoreResult {
  const count = experiences.length;
  if (count === 0) {
    return { rebuyScore: null, regretScore: null, unsureScore: null, experienceCount: 0 };
  }

  let totalWeight = 0;
  let rebuyWeighted = 0;
  let regretWeighted = 0;
  let unsureWeighted = 0;

  for (const exp of experiences) {
    const weight = USAGE_DURATION_WEIGHT[exp.usageDuration] ?? 1.0;
    totalWeight += weight;

    rebuyWeighted += REBUY_VALUE[exp.wouldBuyAgain] * weight;

    if (exp.wouldBuyAgain === WouldBuyAgain.NO) {
      // A regret mood makes a "no" count more strongly toward regret.
      const moodBoost = REGRET_MOODS.has(exp.experienceMood) ? 1.25 : 1.0;
      regretWeighted += weight * moodBoost;
    }

    if (exp.wouldBuyAgain === WouldBuyAgain.UNSURE) {
      unsureWeighted += weight;
    }
  }

  if (totalWeight === 0) {
    return { rebuyScore: null, regretScore: null, unsureScore: null, experienceCount: count };
  }

  const rebuyScore = clampScore((rebuyWeighted / totalWeight) * 100);
  const regretScore = clampScore((regretWeighted / totalWeight) * 100);
  const unsureScore = clampScore((unsureWeighted / totalWeight) * 100);

  return {
    rebuyScore: Math.round(rebuyScore),
    regretScore: Math.round(regretScore),
    unsureScore: Math.round(unsureScore),
    experienceCount: count,
  };
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Distribution of experiences across usage-duration buckets. */
export type UsageDurationStats = Record<UsageDurationType, number>;

export function computeUsageDurationStats(
  experiences: readonly Pick<ScorableExperience, 'usageDuration'>[],
): UsageDurationStats {
  const stats: UsageDurationStats = {
    [UsageDuration.LESS_THAN_WEEK]: 0,
    [UsageDuration.ONE_TO_FOUR_WEEKS]: 0,
    [UsageDuration.ONE_TO_SIX_MONTHS]: 0,
    [UsageDuration.SIX_TO_TWELVE_MONTHS]: 0,
    [UsageDuration.MORE_THAN_YEAR]: 0,
  };
  for (const exp of experiences) {
    stats[exp.usageDuration] = (stats[exp.usageDuration] ?? 0) + 1;
  }
  return stats;
}

/**
 * Qualitative label for a rebuy score, used for badges / color coding.
 */
export function rebuyScoreLabel(score: number | null): 'unknown' | 'low' | 'mixed' | 'high' {
  if (score === null) return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'mixed';
  return 'low';
}
