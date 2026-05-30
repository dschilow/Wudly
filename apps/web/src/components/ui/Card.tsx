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
        'rounded-3xl bg-surface shadow-card ring-1 ring-border/70',
        padded && 'p-5',
        interactive &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
