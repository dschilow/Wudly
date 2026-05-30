import Link from 'next/link';
import type { ProductSummaryDto } from '@wudly/shared';
import { Card } from './ui/Card';
import { Pill } from './ui/Pill';
import { formatScore, scoreTone } from '@/lib/utils';

interface ProductCardProps {
  product: ProductSummaryDto;
  rank?: number;
  /** Which metric to emphasize on the right (rebuy by default). */
  emphasis?: 'rebuy' | 'regret';
}

const toneToPill = {
  positive: 'positive',
  mixed: 'unsure',
  negative: 'negative',
  unknown: 'neutral',
} as const;

/** Compact, tappable product summary card used across lists and rankings. */
export function ProductCard({ product, rank, emphasis = 'rebuy' }: ProductCardProps) {
  const showRegret = emphasis === 'regret';
  const score = showRegret ? product.regretScore : product.rebuyScore;
  const tone = showRegret
    ? product.regretScore !== null && product.regretScore >= 40
      ? 'negative'
      : 'neutral'
    : toneToPill[scoreTone(product.rebuyScore)];

  return (
    <Link href={`/products/${product.id}`} className="block">
      <Card interactive padded className="flex items-center gap-4">
        {rank !== undefined && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-white">
            {rank}
          </div>
        )}

        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-sunken text-2xl">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.canonicalName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden>📦</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-ink">{product.canonicalName}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {product.brand && <span className="font-medium">{product.brand}</span>}
            {product.category && (
              <>
                <span aria-hidden>·</span>
                <span>{product.category.name}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Pill tone={product.experienceCount > 0 ? 'accent' : 'neutral'}>
              {product.experienceCount} Erfahrung{product.experienceCount === 1 ? '' : 'en'}
            </Pill>
            <span className="text-xs text-muted-foreground">
              {product.ownerCount} Besitzer
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="text-2xl font-extrabold tabular-nums"
            style={{
              color:
                tone === 'positive'
                  ? 'var(--color-positive)'
                  : tone === 'negative'
                    ? 'var(--color-regret)'
                    : tone === 'unsure'
                      ? 'var(--color-unsure)'
                      : 'var(--color-muted-foreground)',
            }}
          >
            {formatScore(score)}
          </div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {showRegret ? 'Regret' : 'Wiederkauf'}
          </div>
        </div>
      </Card>
    </Link>
  );
}
