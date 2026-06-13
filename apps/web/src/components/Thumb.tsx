'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProductSummaryDto } from '@wudly/shared';
import { cn } from '@/lib/utils';
import { productPreviewUrl, productThumbUrl, resolveProductImageUrl } from '@/lib/product-media';

/**
 * A product thumbnail framed to look intentional: rounded continuous corners, a
 * hairline ring, and a soft inset so the API's generated preview reads as a
 * crafted tile rather than a raw placeholder.
 *
 * When `pollForPhoto` is set and the product has no real image yet, it quietly
 * polls the cached-photo endpoint for a few seconds and swaps it in the instant
 * the background image hunt succeeds — so a freshly-created product shows its
 * real photo without a manual reload.
 */
export function Thumb({
  product,
  className,
  rounded = 'rounded-[0.7rem]',
  pollForPhoto = false,
}: {
  product: ProductSummaryDto;
  className?: string;
  rounded?: string;
  pollForPhoto?: boolean;
}) {
  const hasRealPhoto = Boolean(resolveProductImageUrl(product.imageUrl));
  const [src, setSrc] = useState(() => productThumbUrl(product));
  const cacheBustRef = useRef(0);

  useEffect(() => {
    setSrc(productThumbUrl(product));
  }, [product]);

  useEffect(() => {
    // Only chase a photo for products that don't have one yet — the hunt runs
    // in the background right after creation and usually lands within seconds.
    if (!pollForPhoto || hasRealPhoto) return;
    const photoUrl = `${productPreviewUrl(product.id).replace(/\/image$/, '')}/photo`;
    let cancelled = false;
    let tries = 0;

    const tick = async () => {
      tries += 1;
      try {
        const res = await fetch(photoUrl, { method: 'HEAD', cache: 'no-store' });
        if (!cancelled && res.ok) {
          // Found — bust any cached 404 and swap the real photo in.
          cacheBustRef.current += 1;
          setSrc(`${photoUrl}?v=${cacheBustRef.current}`);
          return;
        }
      } catch {
        // keep trying
      }
      if (!cancelled && tries < 8) setTimeout(() => void tick(), 1500);
    };
    const start = setTimeout(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [pollForPhoto, hasRealPhoto, product.id]);

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
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => setSrc(productPreviewUrl(product.id))}
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
