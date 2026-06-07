import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { cn } from '@/lib/utils';
import { Thumb } from './Thumb';
import { ScoreBadge } from './ScoreBadge';
import { SealBadge } from './SealBadge';

interface ProductRowProps {
  product: ProductSummaryDto;
  rank?: number;
  emphasis?: 'rebuy' | 'regret';
  /** Last row in a list group → no hairline. */
  last?: boolean;
}

/**
 * A product as an iOS list row: a ranked medal (optional), a framed thumbnail,
 * name + meta, and the designed score chip with its verdict. Sits inside a
 * rounded list group with hairline separators between rows.
 */
export function ProductRow({ product, rank, emphasis = 'rebuy', last }: ProductRowProps) {
  const showRegret = emphasis === 'regret';
  const score = showRegret ? product.regretScore : product.rebuyScore;
  const medal = rank !== undefined && rank <= 3;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block"
      aria-label={`${product.canonicalName} ansehen`}
    >
      <div
        className={cn(
          'tap relative flex min-h-[4.65rem] items-center gap-3 px-3.5 py-2.5 transition-colors duration-150 hover:bg-fill',
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
              Erfahrung{product.experienceCount === 1 ? '' : 'en'}
            </span>
            {product.wudlySeal && <SealBadge />}
          </div>
        </div>

        <ScoreBadge score={score} kind={showRegret ? 'regret' : 'rebuy'} />
        <ChevronRight
          className="-ml-0.5 -mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </div>
    </Link>
  );
}
