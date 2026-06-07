/**
 * Pure product-insight aggregation.
 *
 * Turns a list of experiences (+ their aspects) into the snapshot payload stored
 * in ProductInsightSnapshot and returned by the API. Used by both the backend
 * ProductInsightsService and the seed script, so the numbers are computed
 * identically everywhere. No I/O, fully testable.
 */

import {
  computeScores,
  computeUsageDurationStats,
  type ScorableExperience,
  type UsageDurationStats,
} from './scoring';
import { AspectSentiment, ExperienceMood, UsageDuration } from './enums';
import type {
  AspectSentiment as AspectSentimentType,
  UsageDuration as UsageDurationType,
} from './enums';

export interface AspectInput {
  key: string;
  label: string;
  sentiment: AspectSentimentType;
}

export interface InsightExperienceInput extends ScorableExperience {
  wishKnownText?: string | null;
  /** Comparative regret: what they'd have bought instead. */
  insteadOfText?: string | null;
  aspects: AspectInput[];
}

export interface AspectStat {
  key: string;
  label: string;
  count: number;
  sentiment: AspectSentimentType;
}

export interface InsightSnapshotData {
  ownerCount: number;
  experienceCount: number;
  rebuyScore: number | null;
  regretScore: number | null;
  unsureScore: number | null;
  topPositiveAspects: AspectStat[];
  topNegativeAspects: AspectStat[];
  wishKnownHighlights: string[];
  usageDurationStats: UsageDurationStats;
  suitedFor: string[];
  notSuitedFor: string[];
  insteadOfShare: number;
  insteadOfHighlights: string[];
  /** "Wudly-empfohlen" — a high-trust quality mark (see qualifiesForWudlySeal). */
  wudlySeal: boolean;
}

const MAX_TOP_ASPECTS = 6;
const MAX_WISH_HIGHLIGHTS = 5;
const MAX_INSTEAD_OF = 3;

/* ----------------------------- Wudly-Siegel ------------------------------ *
 * A conservative, automatically-awarded quality mark. We only badge products
 * we're confident about: lots of real owners, a strong rebuy score, and long
 * average real-world usage (so it survived the honeymoon phase). It is recomputed
 * with every snapshot, so it self-revokes if the data turns. */

export const WUDLY_SEAL_MIN_EXPERIENCES = 50;
export const WUDLY_SEAL_MIN_REBUY = 85;
/** Average real usage must be at least this many months. */
export const WUDLY_SEAL_MIN_AVG_MONTHS = 6;

/** Representative month count per usage bucket, for an average-usage estimate. */
const USAGE_DURATION_MONTHS: Record<UsageDurationType, number> = {
  [UsageDuration.LESS_THAN_WEEK]: 0.25,
  [UsageDuration.ONE_TO_FOUR_WEEKS]: 0.75,
  [UsageDuration.ONE_TO_SIX_MONTHS]: 3,
  [UsageDuration.SIX_TO_TWELVE_MONTHS]: 9,
  [UsageDuration.MORE_THAN_YEAR]: 18,
};

/** Weighted-average usage in months from a duration distribution. */
export function averageUsageMonths(stats: UsageDurationStats): number {
  let total = 0;
  let months = 0;
  for (const key of Object.keys(USAGE_DURATION_MONTHS) as UsageDurationType[]) {
    const n = stats[key] ?? 0;
    total += n;
    months += n * USAGE_DURATION_MONTHS[key];
  }
  return total === 0 ? 0 : months / total;
}

/**
 * Whether a product earns the "Wudly-empfohlen" seal. Pure & deterministic so the
 * API and UI agree. Trust is built before the seal is ever monetized.
 */
export function qualifiesForWudlySeal(input: {
  experienceCount: number;
  rebuyScore: number | null;
  usageDurationStats: UsageDurationStats;
}): boolean {
  if (input.rebuyScore === null) return false;
  if (input.experienceCount < WUDLY_SEAL_MIN_EXPERIENCES) return false;
  if (input.rebuyScore < WUDLY_SEAL_MIN_REBUY) return false;
  return averageUsageMonths(input.usageDurationStats) >= WUDLY_SEAL_MIN_AVG_MONTHS;
}

/**
 * Build the full insight payload for a product from its experiences.
 *
 * @param experiences experiences to aggregate (already filtered to public if needed)
 * @param ownerCount  distinct owner count (passed in since it comes from a separate table)
 */
export function buildInsightSnapshot(
  experiences: readonly InsightExperienceInput[],
  ownerCount: number,
): InsightSnapshotData {
  const scores = computeScores(experiences);
  const usageDurationStats = computeUsageDurationStats(experiences);

  const positiveTally = new Map<string, AspectStat>();
  const negativeTally = new Map<string, AspectStat>();

  for (const exp of experiences) {
    for (const aspect of exp.aspects) {
      const bucket =
        aspect.sentiment === AspectSentiment.NEGATIVE
          ? negativeTally
          : aspect.sentiment === AspectSentiment.POSITIVE
            ? positiveTally
            : null;
      if (!bucket) continue;

      const existing = bucket.get(aspect.key);
      if (existing) {
        existing.count += 1;
      } else {
        bucket.set(aspect.key, {
          key: aspect.key,
          label: aspect.label,
          count: 1,
          sentiment: aspect.sentiment,
        });
      }
    }
  }

  const wishKnownHighlights = experiences
    .map((e) => e.wishKnownText?.trim())
    .filter((t): t is string => Boolean(t && t.length > 0))
    .slice(0, MAX_WISH_HIGHLIGHTS);

  const { suitedFor, notSuitedFor } = deriveAudience(experiences);

  const insteadOfTexts = experiences
    .map((e) => e.insteadOfText?.trim())
    .filter((t): t is string => Boolean(t && t.length > 0));
  const insteadOfShare =
    scores.experienceCount > 0
      ? Math.round((insteadOfTexts.length / scores.experienceCount) * 100)
      : 0;
  const insteadOfHighlights = topByFrequency(insteadOfTexts, MAX_INSTEAD_OF);

  const wudlySeal = qualifiesForWudlySeal({
    experienceCount: scores.experienceCount,
    rebuyScore: scores.rebuyScore,
    usageDurationStats,
  });

  return {
    ownerCount,
    experienceCount: scores.experienceCount,
    rebuyScore: scores.rebuyScore,
    regretScore: scores.regretScore,
    unsureScore: scores.unsureScore,
    topPositiveAspects: sortAspects(positiveTally),
    topNegativeAspects: sortAspects(negativeTally),
    wishKnownHighlights,
    usageDurationStats,
    suitedFor,
    notSuitedFor,
    insteadOfShare,
    insteadOfHighlights,
    wudlySeal,
  };
}

/** Most-frequent normalized strings (case-insensitive grouping), original casing kept. */
function topByFrequency(values: string[], limit: number): string[] {
  const groups = new Map<string, { count: number; text: string }>();
  for (const value of values) {
    const key = value.toLowerCase().replace(/\s+/g, ' ').trim();
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { count: 1, text: value });
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit)
    .map((g) => g.text);
}

function sortAspects(tally: Map<string, AspectStat>): AspectStat[] {
  return [...tally.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_TOP_ASPECTS);
}

/**
 * Very lightweight, rule-based "for whom (not) suited" derivation for the MVP.
 * Real nuance will later come from the AI summary; this is deterministic and safe.
 */
function deriveAudience(experiences: readonly InsightExperienceInput[]): {
  suitedFor: string[];
  notSuitedFor: string[];
} {
  const suitedFor = new Set<string>();
  const notSuitedFor = new Set<string>();

  let longTermPositive = 0;
  let defective = 0;
  let regret = 0;

  for (const exp of experiences) {
    if (
      (exp.usageDuration === 'SIX_TO_TWELVE_MONTHS' || exp.usageDuration === 'MORE_THAN_YEAR') &&
      exp.wouldBuyAgain === 'YES'
    ) {
      longTermPositive += 1;
    }
    if (exp.experienceMood === ExperienceMood.DEFECTIVE) defective += 1;
    if (exp.experienceMood === ExperienceMood.REGRET) regret += 1;
  }

  if (longTermPositive >= 2) {
    suitedFor.add('Wer Wert auf langfristige Zuverlässigkeit legt');
  }
  if (defective === 0 && experiences.length >= 3) {
    suitedFor.add('Wer ein robustes Produkt sucht');
  }
  if (defective >= 1) {
    notSuitedFor.add('Wer keine Geduld mit möglichem Support-/Defektaufwand hat');
  }
  if (regret >= 1) {
    notSuitedFor.add('Wer ein sicheres Preis-Leistungs-Verhältnis erwartet');
  }

  return { suitedFor: [...suitedFor], notSuitedFor: [...notSuitedFor] };
}
