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
import { AspectSentiment, ExperienceMood } from './enums';
import type { AspectSentiment as AspectSentimentType } from './enums';

export interface AspectInput {
  key: string;
  label: string;
  sentiment: AspectSentimentType;
}

export interface InsightExperienceInput extends ScorableExperience {
  wishKnownText?: string | null;
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
}

const MAX_TOP_ASPECTS = 6;
const MAX_WISH_HIGHLIGHTS = 5;

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
  };
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
