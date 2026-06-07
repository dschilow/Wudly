import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Wudly-empfohlen" seal. Auto-awarded to products with lots of real owners, a
 * strong rebuy score and long average usage — a high-trust quality mark. Kept
 * deliberately calm (positive tone, no neon) per the design system.
 */
export function SealBadge({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  if (size === 'lg') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-3 py-1 text-[0.8125rem] font-semibold text-positive-ink',
          className,
        )}
      >
        <BadgeCheck className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.4} aria-hidden />
        Wudly-empfohlen
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-positive-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-positive-ink',
        className,
      )}
      title="Wudly-empfohlen"
    >
      <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      Empfohlen
    </span>
  );
}
