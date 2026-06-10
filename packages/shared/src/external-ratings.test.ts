import { describe, it, expect } from 'vitest';
import {
  externalRatingPercent,
  formatExternalRating,
  formatRatingCount,
} from './external-ratings';
import { ExternalRatingKind } from './enums';

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
