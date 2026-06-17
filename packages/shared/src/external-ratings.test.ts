import { describe, it, expect } from 'vitest';
import {
  externalRatingPercent,
  formatExternalRating,
  formatRatingCount,
  aggregateExternalConsensus,
} from './external-ratings';
import { ExternalRatingKind } from './enums';

const stars = (value: number, count?: number | null) => ({
  kind: ExternalRatingKind.STARS,
  value,
  maxValue: 5,
  count,
});

describe('externalRatingPercent', () => {
  it('normalizes stars against their scale', () => {
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.STARS, value: 4.5, maxValue: 5 }),
    ).toBe(90);
    expect(externalRatingPercent({ kind: ExternalRatingKind.STARS, value: 8, maxValue: 10 })).toBe(
      80,
    );
  });

  it('passes percent through (clamped)', () => {
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.PERCENT, value: 87, maxValue: 100 }),
    ).toBe(87);
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.PERCENT, value: 130, maxValue: 100 }),
    ).toBe(100);
  });

  it('inverts German school grades (1 best, 6 worst)', () => {
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.GRADE_DE, value: 1.0, maxValue: 6 }),
    ).toBe(100);
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.GRADE_DE, value: 6.0, maxValue: 6 }),
    ).toBe(0);
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.GRADE_DE, value: 2.1, maxValue: 6 }),
    ).toBe(78);
  });

  it('returns null for unusable inputs', () => {
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.STARS, value: 4, maxValue: 0 }),
    ).toBeNull();
    expect(
      externalRatingPercent({ kind: ExternalRatingKind.STARS, value: Number.NaN, maxValue: 5 }),
    ).toBeNull();
  });
});

describe('formatExternalRating', () => {
  it('formats stars with German decimals and the scale', () => {
    expect(formatExternalRating({ kind: ExternalRatingKind.STARS, value: 4.5, maxValue: 5 })).toBe(
      '4,5 / 5',
    );
    expect(formatExternalRating({ kind: ExternalRatingKind.STARS, value: 4, maxValue: 5 })).toBe(
      '4 / 5',
    );
  });

  it('formats percent', () => {
    expect(
      formatExternalRating({ kind: ExternalRatingKind.PERCENT, value: 87, maxValue: 100 }),
    ).toBe('87 %');
  });

  it('formats German school grades with one decimal', () => {
    expect(
      formatExternalRating({ kind: ExternalRatingKind.GRADE_DE, value: 2.1, maxValue: 6 }),
    ).toBe('Note 2,1');
    expect(
      formatExternalRating({ kind: ExternalRatingKind.GRADE_DE, value: 2, maxValue: 6 }),
    ).toBe('Note 2,0');
  });
});

describe('formatRatingCount', () => {
  it('uses German thousands separators', () => {
    expect(formatRatingCount(1234)).toBe('1.234');
    expect(formatRatingCount(56)).toBe('56');
  });
});

describe('aggregateExternalConsensus', () => {
  it('returns null average and zero sources for no ratings', () => {
    expect(aggregateExternalConsensus([])).toEqual({ avgPercent: null, sourceCount: 0 });
  });

  it('averages equally when no counts are reported', () => {
    // 4★ → 80, 5★ → 100 → mean 90.
    expect(aggregateExternalConsensus([stars(4), stars(5)])).toEqual({
      avgPercent: 90,
      sourceCount: 2,
    });
  });

  it('weights by rating count so the most-rated source dominates', () => {
    // 4★(80) ×9000 + 2★(40) ×10 → ~79.96 → 80, not the unweighted 60.
    const result = aggregateExternalConsensus([stars(4, 9000), stars(2, 10)]);
    expect(result.sourceCount).toBe(2);
    expect(result.avgPercent).toBe(80);
  });

  it('mixes scales by normalizing each before averaging', () => {
    // 4★(80) + Warentest Note 2,0 → (6-2)/5 = 80 → mean 80.
    const result = aggregateExternalConsensus([
      stars(4),
      { kind: ExternalRatingKind.GRADE_DE, value: 2, maxValue: 6 },
    ]);
    expect(result).toEqual({ avgPercent: 80, sourceCount: 2 });
  });

  it('ignores unnormalizable ratings without counting them as a source', () => {
    const result = aggregateExternalConsensus([
      stars(4),
      { kind: ExternalRatingKind.STARS, value: 4, maxValue: 0 },
    ]);
    expect(result).toEqual({ avgPercent: 80, sourceCount: 1 });
  });

  it('treats a zero count as equal weight, not zero weight', () => {
    // Both at 80 with count 0 must still produce 80 (not NaN / null).
    expect(aggregateExternalConsensus([stars(4, 0), stars(4, 0)])).toEqual({
      avgPercent: 80,
      sourceCount: 2,
    });
  });
});
