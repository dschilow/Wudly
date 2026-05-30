import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** className combiner with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
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

/** Resolves a CSS color var for a score tone (for inline styles). */
export function scoreColor(score: number | null, kind: 'rebuy' | 'regret' = 'rebuy'): string {
  if (kind === 'regret') {
    if (score === null) return 'var(--color-faint)';
    return score >= 40 ? 'var(--color-regret)' : 'var(--color-muted-foreground)';
  }
  if (score === null) return 'var(--color-faint)';
  if (score >= 75) return 'var(--color-positive)';
  if (score >= 50) return 'var(--color-unsure)';
  return 'var(--color-regret)';
}

/** Relative-ish German date label. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}
