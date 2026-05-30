import Link from 'next/link';
import { Package, MessageSquare, Users, ChevronRight } from 'lucide-react';
import type { ProductSummaryDto } from '@wudly/shared';
import { Card } from './ui/Card';
import { cn, formatScore, scoreColor } from '@/lib/utils';

interface ProductCardProps {
  product: ProductSummaryDto;
  rank?: number;
  /** Which metric to emphasize on the right (rebuy by default). */
  emphasis?: 'rebuy' | 'regret';
}

/** Compact, tappable product summary card used across lists and rankings. */
export function ProductCard({ product, rank, emphasis = 'rebuy' }: ProductCardProps) {
  const showRegret = emphasis === 'regret';
  const score = showRegret ? product.regretScore : product.rebuyScore;
  const color = scoreColor(score, showRegret ? 'regret' : 'rebuy');
  const pct = score ?? 0;

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <Card interactive padded className="flex items-center gap-3.5">
        {rank !== undefined && (
          <div
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tnum',
              rank <= 3 ? 'bg-ink text-white' : 'bg-surface-sunken text-muted-foreground',
            )}
          >
            {rank}
          </div>
        )}

        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] bg-surface-sunken text-muted-foreground ring-1 ring-border">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.canonicalName}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.95rem] font-semibold text-ink">{product.canonicalName}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {product.brand && <span className="font-medium text-ink-soft">{product.brand}</span>}
            {product.brand && product.category && <span className="text-faint">·</span>}
            {product.category && <span className="truncate">{product.category.name}</span>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[0.7rem] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {product.experienceCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {product.ownerCount}
            </span>
          </div>
        </div>

        {/* Score chip with a thin progress meter */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[1.35rem] font-bold tnum leading-none" style={{ color }}>
              {formatScore(score)}
            </span>
          </div>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-faint">
            {showRegret ? 'Regret' : 'Rekauf'}
          </span>
        </div>

        <ChevronRight
          className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Card>
    </Link>
  );
}
