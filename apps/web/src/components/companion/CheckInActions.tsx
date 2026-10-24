'use client';

import Link from 'next/link';
import { Check, Loader2, PenLine } from 'lucide-react';
import {
  USAGE_DURATION_LABEL,
  WouldBuyAgain,
  type OwnershipCompanionDto,
} from '@wudly/shared';
import { cn } from '@/lib/utils';
import { VERDICT_STYLE } from '@/lib/companion';

const FIRST_VERDICTS = [WouldBuyAgain.YES, WouldBuyAgain.UNSURE, WouldBuyAgain.NO] as const;

/**
 * The check-in decision in one place. With a verdict on file: "Alles wie gehabt"
 * (one tap, a real checkpoint) or "Etwas hat sich geändert" (the wizard, pre-
 * filled). Without one: the three answers — the wizard continues from the tap.
 */
export function CheckInActions({
  companion,
  tone = 'light',
  busy = false,
  onConfirm,
  onChange,
  className,
}: {
  companion: OwnershipCompanionDto;
  tone?: 'light' | 'dark';
  busy?: boolean;
  onConfirm: () => void;
  /** Inside the wizard "Etwas hat sich geändert" continues in place instead of linking. */
  onChange?: () => void;
  className?: string;
}) {
  const dark = tone === 'dark';
  const latest = companion.journey.latest;
  const href = `/products/${companion.productId}/own`;

  if (!latest) {
    return (
      <div className={cn('grid grid-cols-3 gap-2', className)}>
        {FIRST_VERDICTS.map((verdict) => {
          const style = VERDICT_STYLE[verdict];
          const Icon = style.icon;
          return (
            <Link
              key={verdict}
              href={`${href}?verdict=${verdict}`}
              className={cn(
                'press flex h-12 items-center justify-center gap-1.5 rounded-full text-[0.9375rem] font-semibold',
                dark
                  ? 'bg-white/10 text-white ring-1 ring-white/15'
                  : cn('bg-surface shadow-[var(--shadow-xs)] ring-1 ring-border', style.ink),
              )}
            >
              <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.3} aria-hidden />
              {style.short}
            </Link>
          );
        })}
      </div>
    );
  }

  const verdict = VERDICT_STYLE[latest.wouldBuyAgain];
  const changeClass = cn(
    'press flex h-12 items-center justify-center gap-2 rounded-full text-[0.9375rem] font-semibold',
    dark
      ? 'bg-white/10 text-white ring-1 ring-white/15'
      : 'bg-surface text-label shadow-[0_0_0_1px_var(--color-border-strong)]',
  );
  const changeLabel = (
    <>
      <PenLine className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.3} aria-hidden />
      Etwas hat sich geändert
    </>
  );
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="press sheen brand-gradient flex h-12 items-center justify-center gap-2 rounded-full text-[0.9375rem] font-semibold text-white shadow-[var(--shadow-glow)] disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="h-[1.1rem] w-[1.1rem] animate-spin" aria-hidden />
          ) : (
            <Check className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.8} aria-hidden />
          )}
          Alles wie gehabt
        </button>
        {onChange ? (
          <button type="button" onClick={onChange} disabled={busy} className={changeClass}>
            {changeLabel}
          </button>
        ) : (
          <Link href={href} className={changeClass}>
            {changeLabel}
          </Link>
        )}
      </div>
      <p
        className={cn(
          'mt-2 text-center text-[0.75rem] leading-snug',
          dark ? 'text-white/50' : 'text-muted-foreground',
        )}
      >
        Bestätigt „{verdict.short}“ mit der Nutzungsdauer „
        {USAGE_DURATION_LABEL[companion.journey.suggestedUsageDuration]}“.
      </p>
    </div>
  );
}
