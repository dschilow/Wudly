import type { ProductSummaryDto } from '@wudly/shared';
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
}: {
  products: ProductSummaryDto[] | Entry[];
  emphasis?: 'rebuy' | 'regret';
  ranked?: boolean;
  className?: string;
}) {
  const entries: Entry[] = products.map((p, i) =>
    'product' in p ? p : { product: p, rank: ranked ? i + 1 : undefined },
  );

  return (
    <div className={'card overflow-hidden ' + (className ?? '')}>
      {entries.map((entry, i) => (
        <ProductRow
          key={entry.product.id}
          product={entry.product}
          rank={entry.rank}
          emphasis={emphasis}
          last={i === entries.length - 1}
        />
      ))}
    </div>
  );
}
