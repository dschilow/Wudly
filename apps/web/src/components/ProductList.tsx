import type { ProductSummaryDto } from '@wudly/shared';
import { cn } from '@/lib/utils';
import { ProductRow } from './ProductRow';

interface Entry {
  product: ProductSummaryDto;
  rank?: number;
}

/**
 * A grouped iOS list of products (rounded white container, hairline separators).
 * Accepts either bare products or ranked entries.
 */
export function ProductList({
  products,
  emphasis = 'rebuy',
  ranked = false,
  className,
  intent = 'view',
}: {
  products: ProductSummaryDto[] | Entry[];
  emphasis?: 'rebuy' | 'regret';
  ranked?: boolean;
  className?: string;
  /** "own" turns every row into a "do you own this?" shortcut into the wizard. */
  intent?: 'view' | 'own';
}) {
  const entries: Entry[] = products.map((p, i) =>
    'product' in p ? p : { product: p, rank: ranked ? i + 1 : undefined },
  );

  return (
    <div className={cn('card animate-stagger overflow-hidden', className)}>
      {entries.map((entry, i) => (
        <div key={entry.product.id} style={{ ['--i' as string]: i }}>
          <ProductRow
            product={entry.product}
            rank={entry.rank}
            emphasis={emphasis}
            last={i === entries.length - 1}
            intent={intent}
          />
        </div>
      ))}
    </div>
  );
}
