'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ShieldCheck } from 'lucide-react';

const ROOT_ROUTES = new Set(['/', '/check', '/rankings', '/me/products', '/me']);

/**
 * App navigation bar.
 *
 * Root tabs (Prüfen / Entdecken / Besitzen / Ich) show the centered serif
 * "Wudly" wordmark with a single trust affordance on the right — calm, premium,
 * brand-forward, matching the product mockups. Each page provides its own large
 * title below this bar. Deep routes swap to a plain back affordance.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const isRoot = ROOT_ROUTES.has(pathname);

  if (!isRoot) {
    return (
      <header className="safe-top sticky top-0 z-30 bg-canvas/80 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-2xl items-center px-2">
          <button
            onClick={() => router.back()}
            className="tap-dim -ml-1 flex items-center gap-0.5 pr-2 text-[1.0625rem] text-accent"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-[1.5rem] w-[1.5rem]" strokeWidth={2.4} />
            <span className="font-normal">Zurück</span>
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="safe-top sticky top-0 z-30 bg-canvas/80 backdrop-blur-2xl backdrop-saturate-150">
      <div className="relative mx-auto flex h-14 max-w-2xl items-center justify-center px-4">
        <Link href="/check" className="tap-dim" aria-label="Wudly — Startseite">
          <span className="font-display text-[1.6rem] font-semibold leading-none text-accent">
            Wudly
          </span>
        </Link>
        <Link
          href="/me"
          aria-label="Vertrauen & Konto"
          className="press absolute right-3 grid h-10 w-10 place-items-center rounded-[0.9rem] bg-surface text-accent shadow-[var(--shadow-card)] ring-1 ring-border"
        >
          <ShieldCheck className="h-[1.3rem] w-[1.3rem]" strokeWidth={2.1} />
        </Link>
      </div>
    </header>
  );
}
