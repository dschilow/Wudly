import { BadgeEuro, Gift, Link2, Megaphone, ShieldCheck, Store, UserCheck } from 'lucide-react';
import { DISCLOSURE_META, type DisclosureType } from '@wudly/shared';
import { cn } from '@/lib/utils';

/**
 * Mandatory transparency label for any commercial / creator contribution.
 * Commercial disclosures (paid, manufacturer, merchant) are flagged in a strong
 * accent tone; free-product / affiliate use a warm amber; neutral ones stay calm.
 *
 * This is the product's core trust mechanic — it must be visible, never hidden.
 */

const ICONS: Record<string, typeof ShieldCheck> = {
  WUDLY_NATIVE: ShieldCheck,
  SELF_BOUGHT: UserCheck,
  INDEPENDENT_TEST: UserCheck,
  FREE_PRODUCT: Gift,
  AFFILIATE: Link2,
  PAID_PARTNERSHIP: Megaphone,
  MANUFACTURER: BadgeEuro,
  MERCHANT: Store,
};

const TONE_CLASSES: Record<'neutral' | 'warning' | 'commercial', string> = {
  neutral: 'bg-fill-2 text-muted-foreground',
  warning: 'bg-unsure-soft text-unsure-ink',
  commercial: 'bg-accent-soft text-accent-ink',
};

export function DisclosureBadge({
  type,
  size = 'sm',
  withHint = false,
  className,
}: {
  type: DisclosureType;
  size?: 'sm' | 'lg';
  withHint?: boolean;
  className?: string;
}) {
  const meta = DISCLOSURE_META[type];
  if (!meta) return null;
  const Icon = ICONS[type] ?? Megaphone;
  const tone = TONE_CLASSES[meta.tone];

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-[0.9rem] px-3.5 py-2.5',
          tone,
          className,
        )}
      >
        <Icon className="mt-0.5 h-[1.1rem] w-[1.1rem] shrink-0" strokeWidth={2.2} aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[0.875rem] font-semibold leading-tight">
            {meta.label}
            {meta.commercial && (
              <span className="rounded-full bg-current/15 px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wide">
                Werbung
              </span>
            )}
          </div>
          {withHint && <p className="mt-0.5 text-[0.8125rem] leading-snug opacity-90">{meta.hint}</p>}
        </div>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
        tone,
        className,
      )}
      title={meta.hint}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
      {meta.label}
    </span>
  );
}
