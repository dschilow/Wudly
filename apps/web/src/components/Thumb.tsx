import type { ProductSummaryDto } from '@wudly/shared';
import { cn } from '@/lib/utils';
import { productThumbUrl } from '@/lib/product-media';

/**
 * A product thumbnail framed to look intentional: rounded continuous corners, a
 * hairline ring, and a soft inset so the API's generated preview reads as a
 * crafted tile rather than a raw placeholder.
 */
export function Thumb({
  product,
  className,
  rounded = 'rounded-[0.7rem]',
}: {
  product: ProductSummaryDto;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden bg-surface-muted ring-1 ring-black/[0.06] transition-transform duration-200 group-hover:scale-[1.03]',
        rounded,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={productThumbUrl(product)}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {/* subtle top sheen for depth */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -8px 14px rgba(0,0,0,0.04)',
        }}
      />
    </div>
  );
}
