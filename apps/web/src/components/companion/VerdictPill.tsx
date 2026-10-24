import type { WouldBuyAgain } from '@wudly/shared';
import { cn } from '@/lib/utils';
import { VERDICT_STYLE } from '@/lib/companion';

/** Compact verdict tag: icon + "Ja" / "Unsicher" / "Nein" in the verdict tone. */
export function VerdictPill({
  verdict,
  long = false,
  onDark = false,
  className,
}: {
  verdict: WouldBuyAgain;
  /** "Würde ich wieder kaufen" instead of "Ja". */
  long?: boolean;
  /** On the always-dark verdict panel the light-mode tints would vanish. */
  onDark?: boolean;
  className?: string;
}) {
  const style = VERDICT_STYLE[verdict];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold',
        onDark ? 'bg-white/12 text-white' : cn(style.soft, style.ink),
        className,
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5', onDark && 'rounded-full p-px', onDark && style.solid)}
        strokeWidth={2.5}
        aria-hidden
      />
      {long ? style.long : style.short}
    </span>
  );
}
