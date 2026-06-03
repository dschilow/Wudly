import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { cn, formatScore, scoreColor } from '@/lib/utils';
import { productThumbUrl } from '@/lib/product-media';

interface ProductRowProps {
  product: ProductSummaryDto;
  rank?: number;
  emphasis?: 'rebuy' | 'regret';
  /** Last row in a list group → no hairline. */
  last?: boolean;
}

function Thumb({ product }: { product: ProductSummaryDto }) {
  // Real image when set, else the API's generated per-category preview.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={productThumbUrl(product)}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-11 w-11 shrink-0 rounded-[0.5rem] bg-fill-2 object-cover"
    />
  );
}

/**
 * A product as an iOS list row: thumbnail, name + meta, a clean colored score, and
 * a disclosure chevron. Designed to sit inside a rounded list group (hairline
 * separators between rows).
 */
export function ProductRow({ product, rank, emphasis = 'rebuy', last }: ProductRowProps) {
  const showRegret = emphasis === 'regret';
  const score = showRegret ? product.regretScore : product.rebuyScore;
  const color = scoreColor(score, showRegret ? 'regret' : 'rebuy');

  return (
    <Link href={`/products/${product.id}`} className="block">
      <div
        className={cn('tap relative flex items-center gap-3 px-4 py-2.5', !last && 'hairline')}
        style={{ ['--hairline-inset' as string]: '4.5rem' }}
      >
        {rank !== undefined && (
          <span className="w-4 shrink-0 text-center text-[0.9375rem] font-semibold tnum text-faint">
            {rank}
          </span>
        )}
        <Thumb product={product} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.0625rem] leading-tight text-label">
            {product.canonicalName}
          </div>
          <div className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
            {[product.brand, product.category?.name].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="mt-0.5 text-[0.75rem] text-faint">
            {product.experienceCount} Erfahrung{product.experienceCount === 1 ? '' : 'en'}
          </div>
        </div>

        <div className="flex shrink-0 items-baseline">
          <span className="text-[1.4rem] font-semibold tnum leading-none" style={{ color }}>
            {formatScore(score)}
          </span>
        </div>
        <ChevronRight
          className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      </div>
    </Link>
  );
}
