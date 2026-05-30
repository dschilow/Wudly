import type { ReactNode } from 'react';
import { MobileHeader } from './MobileHeader';
import { BottomNavigation } from './BottomNavigation';

/**
 * App chrome: sticky mobile header, a centered content column (max-width for
 * desktop comfort), and a fixed bottom navigation on mobile. Extra bottom padding
 * keeps content clear of the bottom nav.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MobileHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-12">{children}</main>
      <BottomNavigation />
    </div>
  );
}
