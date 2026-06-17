import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetConsensusBadgeProps {
  /** Average of external ratings normalized to 0–100, or null when none. */
  avgPercent: number | null;
  /** How many external sources back the average. */
  sourceCount: number;
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * "Netz-Konsens" — a compact summary of what OTHER platforms say about a product
 * (Amazon, Idealo, Stiftung Warentest …), averaged to a single 0–100 number.
 *
 * Deliberately neutral gray and globe-marked: this is external orientation, NOT
 * the Wudly Signal. It never borrows the Signal's green, mirroring the rule on the
 * product page's "Bewertungen anderswo" section. Renders nothing without sources,
 * so it only appears where there's real external data to summarize.
 */
export function NetConsensusBadge({
  avgPercent,
  sourceCount,
  size = 'sm',
  className,
}: NetConsensusBadgeProps) {
  if (avgPercent === null || sourceCount <= 0) return null;

  const sourceLabel = `${sourceCount} ${sourceCount === 1 ? 'Quelle' : 'Quellen'}`;
  const title = `Netz-Konsens aus ${sourceLabel} (zählt nicht ins Wudly Signal)`;

  if (size === 'lg') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1 text-[0.8125rem] font-semibold text-label-2',
          className,
        )}
        title={title}
      >
        <Globe className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} aria-hidden />
        Netz {avgPercent}% · {sourceLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-fill-2 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-label-2',
        className,
      )}
      title={title}
    >
      <Globe className="h-3.5 w-3.5" strokeWidth={2.3} aria-hidden />
      Netz {avgPercent}%
    </span>
  );
}
