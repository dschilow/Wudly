/**
 * The "Verdict" — Wudly's core value expressed as one consistent visual language
 * wherever a rebuy score appears: a short word, a sentence, and a color band.
 * Color thresholds match the web (green ≥75, amber ≥50, red below) but resolve to
 * concrete palette colors instead of CSS variables.
 */
import type { Palette } from './colors';

export type VerdictTone = 'positive' | 'mixed' | 'negative' | 'unknown';

export interface Verdict {
  tone: VerdictTone;
  /** One word for chips/badges, e.g. "Top". */
  short: string;
  /** A sentence for banners, e.g. "Würden es wieder kaufen". */
  label: string;
  /** Solid color (ring stroke / number). */
  color: string;
  /** Readable ink on a soft tint. */
  ink: string;
  /** Soft tinted background. */
  soft: string;
}

export function rebuyVerdict(score: number | null, c: Palette): Verdict {
  if (score === null) {
    return {
      tone: 'unknown',
      short: 'Offen',
      label: 'Noch keine Wertung',
      color: c.faint,
      ink: c.mutedForeground,
      soft: c.fill2,
    };
  }
  if (score >= 75) {
    return {
      tone: 'positive',
      short: score >= 90 ? 'Top' : 'Stark',
      label: 'Würden es wieder kaufen',
      color: c.positive,
      ink: c.positiveInk,
      soft: c.positiveSoft,
    };
  }
  if (score >= 50) {
    return {
      tone: 'mixed',
      short: 'Gemischt',
      label: 'Geteilte Meinungen',
      color: c.unsure,
      ink: c.unsureInk,
      soft: c.unsureSoft,
    };
  }
  return {
    tone: 'negative',
    short: score < 25 ? 'Flop' : 'Schwach',
    label: 'Würden es nicht nochmal kaufen',
    color: c.regret,
    ink: c.regretInk,
    soft: c.regretSoft,
  };
}

export const EARLY_SIGNAL_MIN_EXPERIENCES = 20;

export function isEarlySignal(experienceCount: number): boolean {
  return experienceCount < EARLY_SIGNAL_MIN_EXPERIENCES;
}

export function dataConfidenceLabel(experienceCount: number): string {
  if (experienceCount < EARLY_SIGNAL_MIN_EXPERIENCES) return 'Zu wenige Bewertungen';
  if (experienceCount < 80) return 'Erste Tendenz';
  if (experienceCount < 250) return 'Solide Datenbasis';
  return 'Sehr große Datenbasis';
}
