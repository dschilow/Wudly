'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { BadgeCheck, MessagesSquare, PenLine } from 'lucide-react';
import { AskForm } from '@/components/AskForm';
import { Sheet } from '@/components/ui/Sheet';
import { dueCheckInLabel } from '@wudly/shared';
import { useViewerCompanion } from '@/lib/use-viewer-companion';

/**
 * The product page's floating action pair. "Fragen" opens the composer as a
 * bottom sheet right in context — no page swap, drag down to dismiss.
 *
 * The bar tucks itself away while the visitor is actively reading (scrolling
 * down past the tabs, decision brief, reviews …) and reappears the moment
 * they pause or scroll back up — so it never sits permanently on top of the
 * tab bar or content the way a plain `position: fixed` bar would.
 *
 * From `lg` up it stays out of the way entirely: the sidebar carries the same
 * call to action there, and two of them on one screen just competed.
 */
export function ProductActionBar({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [askOpen, setAskOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const companion = useViewerCompanion(productId);
  const dueLabel = companion ? dueCheckInLabel(companion.journey) : null;

  useMotionValueEvent(scrollY, 'change', (y) => {
    const delta = y - lastY.current;
    // Ignore iOS overscroll jitter near the very top; always show there.
    if (y < 80) {
      setHidden(false);
    } else if (delta > 8) {
      setHidden(true);
    } else if (delta < -8) {
      setHidden(false);
    }
    lastY.current = y;
  });

  return (
    <>
      <motion.div
        animate={reduced ? undefined : { y: hidden ? 160 : 0, opacity: hidden ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className="fixed inset-x-0 bottom-[4.6rem] z-30 px-5 pb-[max(env(safe-area-inset-bottom),0px)] md:bottom-4 lg:hidden"
      >
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Link
            href={`/products/${productId}/own`}
            className="press sheen flex h-[3rem] flex-[1.4] items-center justify-center gap-2 rounded-full bg-accent text-[1rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]"
          >
            {companion && dueLabel ? (
              <>
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                {companion.journey.latest ? 'Check-in fällig' : 'Urteil abgeben'}
              </>
            ) : companion ? (
              <>
                <PenLine className="h-5 w-5" strokeWidth={2.2} />
                Urteil aktualisieren
              </>
            ) : (
              <>
                <BadgeCheck className="h-5 w-5" strokeWidth={2.2} />
                Ich besitze es
              </>
            )}
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
      </motion.div>

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
