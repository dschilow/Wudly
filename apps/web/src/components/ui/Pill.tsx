import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'positive' | 'negative' | 'unsure' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-fill-2 text-muted-foreground',
  positive: 'bg-positive-soft text-positive-ink',
  negative: 'bg-regret-soft text-regret-ink',
  unsure: 'bg-unsure-soft text-unsure-ink',
  accent: 'bg-accent-soft text-accent-ink',
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/** Small, restrained iOS-style tag. */
export function Pill({ tone = 'neutral', className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[0.4375rem] px-2 py-0.5 text-[0.75rem] font-medium',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
