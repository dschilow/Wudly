import type { ReactNode } from 'react';
import { MobileHeader } from './MobileHeader';
import { BottomNavigation } from './BottomNavigation';

/**
 * App chrome: translucent iOS nav bar, a centered content column with iOS 16pt
 * side margins, and a fixed bottom tab bar on mobile. Extra bottom padding keeps
 * content clear of the tab bar + home indicator.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MobileHeader />
      <main className="mx-auto w-full max-w-2xl px-5 pb-32 pt-1 md:pb-12">{children}</main>
      <BottomNavigation />
    </div>
  );
}
