import { describe, it, expect } from 'vitest';
import { isExcludedFromRankings } from './moderation';

describe('isExcludedFromRankings', () => {
  it('excludes a vodka brand by name keyword (no category)', () => {
    expect(isExcludedFromRankings({ canonicalName: 'Wodka Gorbatschow' })).toBe(true);
    expect(isExcludedFromRankings({ canonicalName: 'Absolut Vodka 0,7l' })).toBe(true);
  });

  it('excludes by an excluded category slug', () => {
    expect(
      isExcludedFromRankings({ canonicalName: 'Irgendein Bier', categorySlug: 'getraenke' }),
    ).toBe(true);
    expect(
      isExcludedFromRankings({ canonicalName: 'Müsliriegel XYZ', categorySlug: 'lebensmittel' }),
    ).toBe(true);
  });

  it('keeps durable consumer goods', () => {
    expect(
      isExcludedFromRankings({
        canonicalName: 'Roborock S8 Pro Ultra',
        categorySlug: 'saugroboter',
      }),
    ).toBe(false);
    expect(isExcludedFromRankings({ canonicalName: 'iPhone 15 Pro' })).toBe(false);
    // "wein" must not false-positive inside unrelated words.
    expect(isExcludedFromRankings({ canonicalName: 'Weinberger Werkzeugkoffer' })).toBe(false);
  });
});
