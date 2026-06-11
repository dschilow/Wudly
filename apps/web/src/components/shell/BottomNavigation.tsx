'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Box, Compass, Search, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Icons that read better filled when active (e.g. the "Besitzen" cube). */
  fillActive?: boolean;
  match: (path: string) => boolean;
}

const items: NavItem[] = [
  {
    href: '/check',
    label: 'Prüfen',
    icon: Search,
    match: (p) => p === '/' || p.startsWith('/check'),
  },
  { href: '/rankings', label: 'Entdecken', icon: Compass, match: (p) => p.startsWith('/rankings') },
  {
    href: '/me/products',
    label: 'Besitzen',
    icon: Box,
    fillActive: true,
    match: (p) => p.startsWith('/me/products'),
  },
  {
    href: '/me',
    label: 'Ich',
    icon: User,
    match: (p) => p === '/me' || (p.startsWith('/me/') && !p.startsWith('/me/products')),
  },
];

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const filled = active && item.fillActive;

  return (
    <li className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={() => navigator.vibrate?.(6)}
        className={cn(
          'tap-dim relative flex flex-col items-center gap-1 pb-1 pt-2.5 text-[0.6875rem] font-medium tracking-tight transition-colors duration-200',
          active ? 'text-accent' : 'text-faint',
        )}
      >
        <motion.span
          className="relative grid place-items-center"
          animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        >
          {/* Shared "platter" glides between tabs (iOS-style active indicator). */}
          {active && (
            <motion.span
              layoutId="tab-platter"
              aria-hidden
              className="absolute -inset-x-3.5 -inset-y-1 rounded-full bg-accent-soft"
              transition={{ type: 'spring', stiffness: 480, damping: 38 }}
            />
          )}
          <Icon
            className="relative h-[1.55rem] w-[1.55rem]"
            strokeWidth={active ? 2.4 : 1.9}
            fill={filled ? 'currentColor' : 'none'}
            aria-hidden
          />
        </motion.span>
        {item.label}
      </Link>
    </li>
  );
}

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-canvas/88 backdrop-blur-2xl backdrop-saturate-150 md:hidden">
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2">
        {items.map((item) => (
          <Tab key={item.href} item={item} active={item.match(pathname)} />
        ))}
      </ul>
    </nav>
  );
}
