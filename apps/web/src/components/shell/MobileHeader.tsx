'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROOT_ROUTES = new Set(['/', '/check', '/rankings', '/me/products', '/me']);

/**
 * Editorial masthead. Root tabs show the serif-italic "Wudly" wordmark with a
 * thin rule underneath — a magazine header, not an app toolbar. Deep routes
 * swap to a plain back affordance. Scroll-aware: flat at the top, gaining its
 * rule + denser material once content slides beneath.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12));

  const isRoot = ROOT_ROUTES.has(pathname);

  const chrome = cn(
    'safe-top sticky top-0 z-30 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow] duration-300',
    scrolled ? 'bg-canvas/90 shadow-[0_1px_0_var(--color-separator)]' : 'bg-canvas/55',
  );

  if (!isRoot) {
    return (
      <header className={chrome}>
        <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-2">
          <button
            onClick={() => router.back()}
            className="tap-dim -ml-1 flex items-center gap-0.5 pr-2 text-[1.0625rem] text-accent"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-[1.5rem] w-[1.5rem]" strokeWidth={2.4} />
            <span>Zurück</span>
          </button>
          <Link href="/check" className="tap-dim pr-2" aria-label="Wudly — Startseite">
            <span className="font-display text-[1.35rem] italic leading-none text-accent">
              Wudly
            </span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className={chrome}>
      <div className="relative mx-auto flex h-14 max-w-2xl items-end justify-between px-5 pb-2">
        <Link href="/check" className="tap-dim" aria-label="Wudly — Startseite">
          <span className="font-display text-[1.85rem] italic leading-none text-accent">
            Wudly
          </span>
        </Link>
        <span className="mono-data pb-0.5 text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
          Echte Besitzer
        </span>
      </div>
    </header>
  );
}
