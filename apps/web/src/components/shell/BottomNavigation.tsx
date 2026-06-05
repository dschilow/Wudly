'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, BarChart3, User, Camera, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

/** Two tabs flank the raised center scan action (Start · Charts · [Scan] · Suche · Profil). */
const leftItems: NavItem[] = [
  { href: '/', label: 'Start', icon: Home, match: (p) => p === '/' },
  { href: '/rankings', label: 'Charts', icon: BarChart3, match: (p) => p.startsWith('/rankings') },
];
const rightItems: NavItem[] = [
  { href: '/check', label: 'Suche', icon: Search, match: (p) => p.startsWith('/check') },
  { href: '/me', label: 'Profil', icon: User, match: (p) => p === '/me' || p.startsWith('/me/') },
];

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li className="flex-1">
      <Link
        href={item.href}
        className={cn(
          'tap-dim flex flex-col items-center gap-1 pb-1 pt-2 text-[0.625rem] font-medium tracking-tight',
          active ? 'text-accent' : 'text-faint',
        )}
      >
        <Icon className="h-[1.55rem] w-[1.55rem]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}

/**
 * iOS UITabBar with a raised center scan action — the camera is the app's
 * signature gesture, so it gets pride of place instead of being buried in a
 * screen. Translucent material, top hairline, filled active tint.
 */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-canvas/80 backdrop-blur-2xl backdrop-saturate-150 md:hidden">
      <ul className="mx-auto flex max-w-lg items-end justify-around">
        {leftItems.map((item) => (
          <Tab key={item.href} item={item} active={item.match(pathname)} />
        ))}

        <li className="flex flex-1 justify-center">
          <Link
            href="/check?scan=1"
            aria-label="Produkt scannen"
            className="press -mt-7 grid h-[3.5rem] w-[3.5rem] place-items-center rounded-full brand-gradient text-white shadow-[var(--shadow-hero)] ring-4 ring-canvas"
          >
            <Camera className="h-6 w-6" strokeWidth={2.3} aria-hidden />
          </Link>
        </li>

        {rightItems.map((item) => (
          <Tab key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </ul>
    </nav>
  );
}
