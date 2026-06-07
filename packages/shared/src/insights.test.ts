import { describe, it, expect } from 'vitest';
import { buildInsightSnapshot, type InsightExperienceInput } from './insights';
import { WouldBuyAgain, UsageDuration, ExperienceMood, AspectSentiment } from './enums';

function makeExp(overrides: Partial<InsightExperienceInput> = {}): InsightExperienceInput {
  return {
    wouldBuyAgain: WouldBuyAgain.YES,
    usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
    experienceMood: ExperienceMood.GOOD_DAILY_USE,
    wishKnownText: null,
    aspects: [],
    ...overrides,
  };
}

describe('buildInsightSnapshot', () => {
  it('returns empty/null snapshot for no experiences', () => {
    const snap = buildInsightSnapshot([], 0);
    expect(snap.experienceCount).toBe(0);
    expect(snap.rebuyScore).toBeNull();
    expect(snap.topPositiveAspects).toEqual([]);
    expect(snap.topNegativeAspects).toEqual([]);
    expect(snap.wishKnownHighlights).toEqual([]);
  });

  it('tallies positive and negative aspects sorted by frequency', () => {
    const snap = buildInsightSnapshot(
      [
        makeExp({
          aspects: [
            { key: 'saugkraft', label: 'Saugkraft', sentiment: AspectSentiment.POSITIVE },
            { key: 'lautstaerke', label: 'Lautstärke', sentiment: AspectSentiment.NEGATIVE },
          ],
        }),
        makeExp({
          aspects: [{ key: 'saugkraft', label: 'Saugkraft', sentiment: AspectSentiment.POSITIVE }],
        }),
      ],
      2,
    );
    expect(snap.topPositiveAspects[0]).toMatchObject({ key: 'saugkraft', count: 2 });
    expect(snap.topNegativeAspects[0]).toMatchObject({ key: 'lautstaerke', count: 1 });
  });

  it('collects wish-known highlights, ignoring blanks', () => {
    const snap = buildInsightSnapshot(
      [
        makeExp({ wishKnownText: 'Station ist groß' }),
        makeExp({ wishKnownText: '   ' }),
        makeExp({ wishKnownText: null }),
      ],
      3,
    );
    expect(snap.wishKnownHighlights).toEqual(['Station ist groß']);
  });

  it('derives "suited for" when there are multiple positive long-term experiences', () => {
    const snap = buildInsightSnapshot(
      [
        makeExp({ usageDuration: UsageDuration.MORE_THAN_YEAR, wouldBuyAgain: WouldBuyAgain.YES }),
        makeExp({
          usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
          wouldBuyAgain: WouldBuyAgain.YES,
        }),
        makeExp(),
      ],
      3,
    );
    expect(snap.suitedFor.length).toBeGreaterThan(0);
  });

  it('flags "not suited for" when a defective experience exists', () => {
    const snap = buildInsightSnapshot(
      [makeExp({ experienceMood: ExperienceMood.DEFECTIVE, wouldBuyAgain: WouldBuyAgain.NO })],
      1,
    );
    expect(snap.notSuitedFor.length).toBeGreaterThan(0);
  });

  it('aggregates comparative regret (insteadOf) share + top alternatives', () => {
    const snap = buildInsightSnapshot(
      [
        makeExp({ insteadOfText: 'Roborock S8' }),
        makeExp({ insteadOfText: 'roborock s8' }), // same alternative, different casing
        makeExp({ insteadOfText: 'Dreame L20' }),
        makeExp({ insteadOfText: null }),
      ],
      4,
    );
    expect(snap.insteadOfShare).toBe(75); // 3 of 4 named an alternative
    expect(snap.insteadOfHighlights[0]).toBe('Roborock S8'); // most frequent, original casing
    expect(snap.insteadOfHighlights).toContain('Dreame L20');
  });

  it('awards the Wudly seal only with enough long-term high-rebuy data', () => {
    const many = Array.from({ length: 50 }, () =>
      makeExp({
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
      }),
    );
    expect(buildInsightSnapshot(many, 50).wudlySeal).toBe(true);

    // Too few experiences → no seal even if perfect.
    expect(buildInsightSnapshot([makeExp()], 1).wudlySeal).toBe(false);
  });
});
