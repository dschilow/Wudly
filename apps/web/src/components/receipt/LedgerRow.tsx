import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A receipt data line: label ········ value. The dotted leader and mono value
 * are Wudly's signature way of presenting facts.
 */
export function LedgerRow({
  label,
  value,
  strong = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Emphasized line (e.g. the total / the verdict). */
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('ledger-row', className)}>
      <span
        className={cn(
          'shrink-0 text-[0.875rem]',
          strong ? 'font-semibold text-label' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      <span className="leader" aria-hidden />
      <span
        className={cn(
          'mono-data shrink-0 text-[0.875rem]',
          strong ? 'font-semibold text-label' : 'text-ink-soft',
        )}
      >
        {value}
      </span>
    </div>
  );
}
