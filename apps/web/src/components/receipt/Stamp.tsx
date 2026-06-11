import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  positive: 'text-positive-ink',
  regret: 'text-regret-ink',
  unsure: 'text-unsure-ink',
  neutral: 'text-muted-foreground',
} as const;

/**
 * The Wudly verdict stamp — a rubber-stamp style label that "slams" onto the
 * page (slight rotation, overshoot scale). The brand's most recognizable mark:
 * WIEDER KAUFEN / GETEILTES ECHO / LIEBER NICHT.
 */
export function Stamp({
  tone = 'positive',
  animate = true,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  /** Slam-in entrance. Disable for list contexts where it would repeat. */
  animate?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn('stamp select-none', animate ? 'animate-stamp' : '-rotate-2', tones[tone], className)}
    >
      {children}
    </span>
  );
}

/** Maps a rebuy score to the stamp wording + tone. */
export function verdictStamp(score: number | null): {
  label: string;
  tone: keyof typeof tones;
} {
  if (score === null) return { label: 'Noch offen', tone: 'neutral' };
  if (score >= 75) return { label: 'Wieder kaufen', tone: 'positive' };
  if (score >= 50) return { label: 'Geteiltes Echo', tone: 'unsure' };
  return { label: 'Lieber nicht', tone: 'regret' };
}
