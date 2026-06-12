'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, MessagesSquare } from 'lucide-react';
import { AskForm } from '@/components/AskForm';
import { Sheet } from '@/components/ui/Sheet';

/**
 * The product page's floating action pair. "Fragen" opens the composer as a
 * bottom sheet right in context — no page swap, drag down to dismiss.
 */
export function ProductActionBar({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [askOpen, setAskOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-[4.6rem] z-30 px-5 pb-[max(env(safe-area-inset-bottom),0px)] md:bottom-4">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Link
            href={`/products/${productId}/own`}
            className="press sheen flex h-[3rem] flex-[1.4] items-center justify-center gap-2 rounded-full bg-accent text-[1rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]"
          >
            <BadgeCheck className="h-5 w-5" strokeWidth={2.2} />
            Ich besitze es
          </Link>
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(8);
              setAskOpen(true);
            }}
            className="press flex h-[3rem] flex-1 items-center justify-center gap-2 rounded-full bg-surface/95 text-[1rem] font-semibold text-label shadow-[0_0_0_1px_var(--color-border-strong),var(--shadow-card)] backdrop-blur-xl"
          >
            <MessagesSquare className="h-5 w-5" strokeWidth={2.1} />
            Fragen
          </button>
        </div>
      </div>

      <Sheet open={askOpen} onClose={() => setAskOpen(false)} ariaLabel="Besitzer fragen">
        <AskForm
          productId={productId}
          productName={productName}
          onDone={() => setAskOpen(false)}
        />
      </Sheet>
    </>
  );
}
