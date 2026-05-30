import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

/** Soft, rounded surface — the building block of the card-based UI. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, padded = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-2xl)] bg-surface shadow-card ring-1 ring-border',
        padded && 'p-5',
        interactive &&
          'cursor-pointer transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-pop',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
