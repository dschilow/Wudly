'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  match: (path: string) => boolean;
}

const items: NavItem[] = [
  { href: '/', label: 'Start', icon: '🏠', match: (p) => p === '/' },
  { href: '/check', label: 'Prüfen', icon: '🔍', match: (p) => p.startsWith('/check') },
  {
    href: '/rankings',
    label: 'Top & Flop',
    icon: '📊',
    match: (p) => p.startsWith('/rankings'),
  },
  { href: '/me', label: 'Profil', icon: '👤', match: (p) => p === '/me' || p.startsWith('/me/') },
];

/** Fixed bottom navigation — the primary mobile navigation pattern. */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-lg md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-semibold transition-colors',
                  active ? 'text-accent' : 'text-muted-foreground',
                )}
              >
                <span className={cn('text-xl transition-transform', active && 'scale-110')} aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
