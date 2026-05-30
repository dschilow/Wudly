import { describe, it, expect } from 'vitest';
import {
  computeScores,
  computeUsageDurationStats,
  rebuyScoreLabel,
  type ScorableExperience,
} from './scoring';
import { WouldBuyAgain, UsageDuration, ExperienceMood } from './enums';

function exp(
  wouldBuyAgain: ScorableExperience['wouldBuyAgain'],
  usageDuration: ScorableExperience['usageDuration'],
  experienceMood: ScorableExperience['experienceMood'],
): ScorableExperience {
  return { wouldBuyAgain, usageDuration, experienceMood };
}

describe('computeScores', () => {
  it('returns nulls for an empty list', () => {
    const result = computeScores([]);
    expect(result.rebuyScore).toBeNull();
    expect(result.regretScore).toBeNull();
    expect(result.unsureScore).toBeNull();
    expect(result.experienceCount).toBe(0);
  });

  it('gives 100 rebuy when everyone would buy again', () => {
    const result = computeScores([
      exp(WouldBuyAgain.YES, UsageDuration.ONE_TO_SIX_MONTHS, ExperienceMood.TOP_BUY),
      exp(WouldBuyAgain.YES, UsageDuration.MORE_THAN_YEAR, ExperienceMood.GOOD_DAILY_USE),
    ]);
    expect(result.rebuyScore).toBe(100);
    expect(result.regretScore).toBe(0);
  });

  it('gives 0 rebuy and high regret when everyone regrets', () => {
    const result = computeScores([
      exp(WouldBuyAgain.NO, UsageDuration.ONE_TO_SIX_MONTHS, ExperienceMood.REGRET),
      exp(WouldBuyAgain.NO, UsageDuration.ONE_TO_SIX_MONTHS, ExperienceMood.DEFECTIVE),
    ]);
    expect(result.rebuyScore).toBe(0);
    // Regret is boosted (1.25x) for regret moods but capped at 100.
    expect(result.regretScore).toBe(100);
  });

  it('weights long-term experiences more heavily than first-week ones', () => {
    // One enthusiastic first-week YES vs one long-term NO.
    const result = computeScores([
      exp(WouldBuyAgain.YES, UsageDuration.LESS_THAN_WEEK, ExperienceMood.TOP_BUY), // weight 0.5
      exp(WouldBuyAgain.NO, UsageDuration.MORE_THAN_YEAR, ExperienceMood.REGRET), // weight 1.5
    ]);
    // rebuy = (1*0.5 + 0*1.5) / (0.5+1.5) = 0.25 -> 25
    expect(result.rebuyScore).toBe(25);
  });

  it('treats UNSURE as half-positive for rebuy and feeds the unsure score', () => {
    const result = computeScores([
      exp(WouldBuyAgain.UNSURE, UsageDuration.ONE_TO_SIX_MONTHS, ExperienceMood.OKAY),
    ]);
    expect(result.rebuyScore).toBe(50);
    expect(result.unsureScore).toBe(100);
    expect(result.regretScore).toBe(0);
  });

  it('counts experiences regardless of weighting', () => {
    const result = computeScores([
      exp(WouldBuyAgain.YES, UsageDuration.LESS_THAN_WEEK, ExperienceMood.TOP_BUY),
      exp(WouldBuyAgain.NO, UsageDuration.LESS_THAN_WEEK, ExperienceMood.REGRET),
      exp(WouldBuyAgain.UNSURE, UsageDuration.LESS_THAN_WEEK, ExperienceMood.OKAY),
    ]);
    expect(result.experienceCount).toBe(3);
  });
});

describe('computeUsageDurationStats', () => {
  it('buckets experiences by duration', () => {
    const stats = computeUsageDurationStats([
      { usageDuration: UsageDuration.LESS_THAN_WEEK },
      { usageDuration: UsageDuration.LESS_THAN_WEEK },
      { usageDuration: UsageDuration.MORE_THAN_YEAR },
    ]);
    expect(stats[UsageDuration.LESS_THAN_WEEK]).toBe(2);
    expect(stats[UsageDuration.MORE_THAN_YEAR]).toBe(1);
    expect(stats[UsageDuration.ONE_TO_SIX_MONTHS]).toBe(0);
  });
});

describe('rebuyScoreLabel', () => {
  it('maps scores to qualitative labels', () => {
    expect(rebuyScoreLabel(null)).toBe('unknown');
    expect(rebuyScoreLabel(90)).toBe('high');
    expect(rebuyScoreLabel(60)).toBe('mixed');
    expect(rebuyScoreLabel(20)).toBe('low');
  });
});
