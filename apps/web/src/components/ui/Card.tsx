import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

/**
 * iOS grouped-content container: a rounded white surface on the grouped
 * background. Flat by design — iOS separates content with the background gap and
 * hairlines, not drop shadows. `interactive` adds a subtle press-dim.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, padded = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-lg)] bg-surface',
        padded && 'p-4',
        interactive && 'tap cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
