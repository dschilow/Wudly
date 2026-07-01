import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { cn } from '@/lib/utils';
import { isEarlySignal } from '@/lib/verdict';
import { Thumb } from './Thumb';
import { ScoreBadge } from './ScoreBadge';
import { SealBadge } from './SealBadge';
import { productPath } from '@/lib/seo';
import { NetConsensusBadge } from './NetConsensusBadge';

interface ProductRowProps {
  product: ProductSummaryDto;
  rank?: number;
  emphasis?: 'rebuy' | 'regret';
  /** Last row in a list group → no hairline. */
  last?: boolean;
  /**
   * "view" (default) opens the product page. "own" turns the row into a
   * "do you own this?" shortcut: it links straight into the experience wizard
   * and trades the score chip for a "Besitze ich" call-to-action.
   */
  intent?: 'view' | 'own';
}

/**
 * A product as an iOS list row: a ranked medal (optional), a framed thumbnail,
 * name + meta, and the designed score chip with its verdict. Sits inside a
 * rounded list group with hairline separators between rows.
 */
export function ProductRow({ product, rank, emphasis = 'rebuy', last, intent = 'view' }: ProductRowProps) {
  const own = intent === 'own';
  const showRegret = emphasis === 'regret';
  const score = showRegret ? product.regretScore : product.rebuyScore;
  const medal = rank !== undefined && rank <= 3;
  const earlySignal = isEarlySignal(product.experienceCount);
  const yesCount =
    product.rebuyScore === null
      ? null
      : Math.round((product.rebuyScore / 100) * product.ownerCount);

  return (
    <Link
      href={own ? `/products/${product.id}/own` : productPath(product)}
      className="group block"
      aria-label={own ? `${product.canonicalName} als Besitzer eintragen` : `${product.canonicalName} ansehen`}
    >
      <div
        className={cn(
          'tap group relative flex min-h-[4.65rem] items-center gap-3 px-3.5 py-2.5 transition-all duration-200 md:hover:bg-fill',
          !last && 'hairline',
        )}
        style={{ ['--hairline-inset' as string]: rank !== undefined ? '5.4rem' : '4.4rem' }}
      >
        {rank !== undefined && (
          <span
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold tnum',
              medal ? 'text-white' : 'text-faint',
            )}
            style={
              medal
                ? {
                    background:
                      rank === 1
                        ? 'linear-gradient(135deg,#ffd76a,#f5a623)'
                        : rank === 2
                          ? 'linear-gradient(135deg,#cdd3dc,#aab2bd)'
                          : 'linear-gradient(135deg,#e3a06a,#c97f43)',
                  }
                : undefined
            }
          >
            {rank}
          </span>
        )}
        <Thumb product={product} className="h-[3.25rem] w-[3.25rem]" />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.0625rem] font-medium leading-tight text-label">
            {product.canonicalName}
          </div>
          <div className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
            {[product.brand, product.category?.name].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[0.75rem] text-faint">
            <span className="flex items-center gap-1">
              <span className="tnum">{product.experienceCount}</span>
              {product.experienceCount === 1 ? 'Erfahrung' : 'Erfahrungen'}
            </span>
            {product.wudlySeal && <SealBadge />}
            <NetConsensusBadge
              avgPercent={product.externalAvgPercent}
              sourceCount={product.externalSourceCount}
            />
          </div>
          {earlySignal && yesCount !== null && !showRegret && (
            <p className="mt-1 truncate text-[0.75rem] font-medium text-positive-ink">
              Noch wenige Bewertungen · {yesCount} von {product.ownerCount} würden wieder kaufen
            </p>
          )}
        </div>

        {own ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[0.8125rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]">
            <Check className="h-4 w-4" strokeWidth={2.7} aria-hidden />
            Besitze ich
          </span>
        ) : (
          <>
            <ScoreBadge
              score={earlySignal && !showRegret ? null : score}
              kind={showRegret ? 'regret' : 'rebuy'}
              labelOverride={earlySignal && !showRegret ? 'Zu früh' : undefined}
            />
            <ChevronRight
              className="-ml-0.5 -mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3 transition-transform duration-200 md:group-hover:translate-x-0.5"
              strokeWidth={2.5}
              aria-hidden
            />
          </>
        )}
      </div>
    </Link>
  );
}
