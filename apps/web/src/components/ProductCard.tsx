import type { ProductSummaryDto } from '@wudly/shared';
import { ProductRow } from './ProductRow';

interface ProductCardProps {
  product: ProductSummaryDto;
  rank?: number;
  emphasis?: 'rebuy' | 'regret';
}

/**
 * A single product as a standalone rounded iOS row. For lists of products prefer
 * {@link ProductList}, which groups rows with hairline separators.
 */
export function ProductCard({ product, rank, emphasis = 'rebuy' }: ProductCardProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
      <ProductRow product={product} rank={rank} emphasis={emphasis} last />
    </div>
  );
}
