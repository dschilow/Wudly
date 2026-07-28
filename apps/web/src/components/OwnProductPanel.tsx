'use client';

import Link from 'next/link';
import { BadgeCheck, PenLine } from 'lucide-react';
import { useViewerOwnsProduct } from '@/lib/use-viewer-owns-product';

/**
 * The desktop sidebar's "next step" card. Mirrors the sticky action bar's
 * wording so a visitor who already rated the product is never asked to
 * declare ownership a second time.
 */
export function OwnProductPanel({ productId }: { productId: string }) {
  const owns = useViewerOwnsProduct(productId);

  return (
    <div className="card p-4">
      <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
        Nächster Schritt
      </p>
      <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
        {owns
          ? 'Du hast dieses Produkt bewertet. Hat sich nach längerer Nutzung etwas geändert?'
          : 'Die beste Hilfe für andere Käufer ist eine echte Langzeiterfahrung zu diesem Produkt.'}
      </p>
      <Link
        href={`/products/${productId}/own`}
        className="press mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[0.9375rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]"
      >
        {owns ? (
          <>
            <PenLine className="h-4 w-4" strokeWidth={2.3} />
            Erfahrung aktualisieren
          </>
        ) : (
          <>
            <BadgeCheck className="h-4 w-4" strokeWidth={2.3} />
            Ich besitze es
          </>
        )}
      </Link>
    </div>
  );
}
