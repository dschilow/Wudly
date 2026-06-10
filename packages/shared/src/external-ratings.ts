/**
 * Pure helpers for external rating facts ("Bewertungen anderswo").
 *
 * External ratings are aggregated numbers from other platforms (average +
 * count + source link). They are displayed for orientation only and NEVER
 * feed the Wudly Signal score — that stays 100% real owner experiences.
 */

import { ExternalRatingKind } from './enums';

/** Minimal shape needed to normalize / format an external rating value. */
export interface ExternalRatingValue {
  kind: ExternalRatingKind;
  value: number;
  /** Scale maximum (5 for stars, 100 for percent; ignored for GRADE_DE). */
  maxValue: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Normalize a rating to a 0–100 "positivity" so different scales can share one
 * visual (bar/ring). GRADE_DE inverts the German school scale (1 best, 6 worst).
 * Returns null when the inputs can't be normalized (zero/negative scale, NaN).
 */
export function externalRatingPercent(rating: ExternalRatingValue): number | null {
  if (!Number.isFinite(rating.value)) return null;
  switch (rating.kind) {
    case ExternalRatingKind.PERCENT:
      return Math.round(clamp01(rating.value / 100) * 100);
    case ExternalRatingKind.GRADE_DE:
      // 1.0 → 100, 6.0 → 0 (linear over the 5-grade span).
      return Math.round(clamp01((6 - rating.value) / 5) * 100);
    case ExternalRatingKind.STARS:
      if (!Number.isFinite(rating.maxValue) || rating.maxValue <= 0) return null;
      return Math.round(clamp01(rating.value / rating.maxValue) * 100);
  }
}

/** German decimal formatting without trailing zeros: 4.5 → "4,5", 4 → "4". */
function formatNumberDe(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

/** Human display of the raw value: "4,5 / 5" · "87 %" · "Note 2,1". */
export function formatExternalRating(rating: ExternalRatingValue): string {
  switch (rating.kind) {
    case ExternalRatingKind.PERCENT:
      return `${formatNumberDe(rating.value)} %`;
    case ExternalRatingKind.GRADE_DE:
      // School grades conventionally keep one decimal ("Note 2,0").
      return `Note ${(Math.round(rating.value * 10) / 10).toFixed(1).replace('.', ',')}`;
    case ExternalRatingKind.STARS:
      return `${formatNumberDe(rating.value)} / ${formatNumberDe(rating.maxValue)}`;
  }
}

/** Compact German count: 1234 → "1.234". */
export function formatRatingCount(count: number): string {
  return new Intl.NumberFormat('de-DE').format(count);
}
