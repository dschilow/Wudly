import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'positive' | 'negative' | 'unsure' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted-foreground',
  positive: 'bg-positive-soft text-positive-ink',
  negative: 'bg-regret-soft text-regret-ink',
  unsure: 'bg-unsure-soft text-unsure-ink',
  accent: 'bg-accent-soft text-accent',
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/** Small rounded label / chip. */
export function Pill({ tone = 'neutral', className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
