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
  layout = 'list',
}: {
  products: ProductSummaryDto[] | Entry[];
  emphasis?: 'rebuy' | 'regret';
  ranked?: boolean;
  className?: string;
  /** "own" turns every row into a "do you own this?" shortcut into the wizard. */
  intent?: 'view' | 'own';
  /**
   * "list" (default): one grouped column with hairline dividers — right for a
   * ranked/ordered read. "grid": each row becomes its own card and reflows
   * into two columns from `lg:` up — right for an unordered catalog, so wide
   * viewports get an actual two-column layout instead of one stretched row.
   */
  layout?: 'list' | 'grid';
}) {
  const entries: Entry[] = products.map((p, i) =>
    'product' in p ? p : { product: p, rank: ranked ? i + 1 : undefined },
  );

  if (layout === 'grid') {
    return (
      <div className={cn('animate-stagger grid gap-2.5 lg:grid-cols-2', className)}>
        {entries.map((entry, i) => (
          <div key={entry.product.id} className="card overflow-hidden" style={{ ['--i' as string]: i }}>
            <ProductRow
              product={entry.product}
              rank={entry.rank}
              emphasis={emphasis}
              last
              intent={intent}
            />
          </div>
        ))}
      </div>
    );
  }

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
