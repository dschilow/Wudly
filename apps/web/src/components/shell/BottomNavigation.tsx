'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, BarChart3, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const items: NavItem[] = [
  { href: '/', label: 'Start', icon: Home, match: (p) => p === '/' },
  { href: '/check', label: 'Prüfen', icon: Search, match: (p) => p.startsWith('/check') },
  { href: '/rankings', label: 'Top & Flop', icon: BarChart3, match: (p) => p.startsWith('/rankings') },
  { href: '/me', label: 'Profil', icon: User, match: (p) => p === '/me' || p.startsWith('/me/') },
];

/** Fixed bottom navigation — the primary mobile navigation pattern. */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/80 backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-semibold transition-colors duration-200',
                  active ? 'text-accent' : 'text-faint hover:text-muted-foreground',
                )}
              >
                {active && (
                  <span className="absolute -top-px h-0.5 w-8 rounded-full bg-accent" aria-hidden />
                )}
                <Icon
                  className={cn('h-[1.35rem] w-[1.35rem] transition-transform', active && 'scale-105')}
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
