'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MobileHeader } from './MobileHeader';
import { BottomNavigation } from './BottomNavigation';

/**
 * App chrome: translucent iOS nav bar, a centered content column with iOS 16pt
 * side margins, and a fixed bottom tab bar on mobile. Extra bottom padding keeps
 * content clear of the tab bar + home indicator.
 *
 * The B2B area `/pulse` brings its own desktop shell (sidebar + topbar) and
 * renders full-bleed without the consumer chrome.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/pulse')) {
    return <div className="min-h-dvh">{children}</div>;
  }
  return (
    <div className="min-h-dvh">
      <div aria-hidden className="app-ambient pointer-events-none fixed inset-0 -z-10" />
      <MobileHeader />
      <main className="mx-auto w-full max-w-6xl px-5 pb-32 pt-1 md:pb-12">{children}</main>
      <BottomNavigation />
    </div>
  );
}
