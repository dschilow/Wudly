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
          aspects: [
            { key: 'saugkraft', label: 'Saugkraft', sentiment: AspectSentiment.POSITIVE },
          ],
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
});
