/** Tiny className combiner (no dependency needed for our usage). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Maps a 0..100 score to a semantic tone used for color coding. */
export function scoreTone(score: number | null): 'positive' | 'mixed' | 'negative' | 'unknown' {
  if (score === null) return 'unknown';
  if (score >= 75) return 'positive';
  if (score >= 50) return 'mixed';
  return 'negative';
}

/** Formats a score for display: number or an em dash when unknown. */
export function formatScore(score: number | null): string {
  return score === null ? '–' : String(score);
}

/** Relative-ish German date label. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}
