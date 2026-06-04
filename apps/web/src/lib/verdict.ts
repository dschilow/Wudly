/**
 * The "verdict" is Wudly's core value, expressed as one consistent visual
 * language everywhere a rebuy score appears: a short word, a sentence, and a
 * color band. Color thresholds match {@link scoreColor} / ScoreRing so a number
 * and its label never disagree (green ≥75, amber ≥50, red below).
 */
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

export function rebuyVerdict(score: number | null): Verdict {
  if (score === null) {
    return {
      tone: 'unknown',
      short: 'Offen',
      label: 'Noch keine Wertung',
      color: 'var(--color-faint)',
      ink: 'var(--color-muted-foreground)',
      soft: 'var(--color-fill-2)',
    };
  }
  if (score >= 75) {
    return {
      tone: 'positive',
      short: score >= 90 ? 'Top' : 'Stark',
      label: 'Würden es wieder kaufen',
      color: 'var(--color-positive)',
      ink: 'var(--color-positive-ink)',
      soft: 'var(--color-positive-soft)',
    };
  }
  if (score >= 50) {
    return {
      tone: 'mixed',
      short: 'Solide',
      label: 'Gemischtes Echo',
      color: 'var(--color-unsure)',
      ink: 'var(--color-unsure-ink)',
      soft: 'var(--color-unsure-soft)',
    };
  }
  return {
    tone: 'negative',
    short: score < 25 ? 'Flop' : 'Schwach',
    label: 'Würden es nicht nochmal kaufen',
    color: 'var(--color-regret)',
    ink: 'var(--color-regret-ink)',
    soft: 'var(--color-regret-soft)',
  };
}
