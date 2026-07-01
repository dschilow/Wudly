'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Box,
  Compass,
  FlaskConical,
  GitCompareArrows,
  Search,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications-context';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  /** Show an unread indicator dot (e.g. pending notifications). */
  notify?: boolean;
}

const BASE_ITEMS: NavItem[] = [
  {
    href: '/check',
    label: 'Prüfen',
    icon: Search,
    match: (p) =>
      p === '/' || p.startsWith('/check') || p.startsWith('/products') || p.startsWith('/produkte'),
  },
  {
    href: '/compare',
    label: 'Vergleich',
    icon: GitCompareArrows,
    match: (p) => p.startsWith('/compare'),
  },
  { href: '/rankings', label: 'Entdecken', icon: Compass, match: (p) => p.startsWith('/rankings') },
  {
    href: '/me/products',
    label: 'Besitzen',
    icon: Box,
    match: (p) => p.startsWith('/me/products'),
  },
  {
    href: '/me',
    label: 'Ich',
    icon: User,
    match: (p) => p === '/me' || (p.startsWith('/me/') && !p.startsWith('/me/products')),
  },
];

/** Admin-only model benchmarking tab, appended for ADMIN users. */
const KI_ITEM: NavItem = {
  href: '/ki-test',
  label: 'KI-Test',
  icon: FlaskConical,
  match: (p) => p.startsWith('/ki-test'),
};

/**
 * Floating dock — a detached glass pill hovering above the content. The active
 * tab gets a monochrome ink platter that glides between items (shared layout
 * animation); the luminous accent stays reserved for verdicts and CTAs. The
 * "Ich" tab carries an unread dot so notifications stay visible app-wide.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const items = user?.role === 'ADMIN' ? [...BASE_ITEMS, KI_ITEM] : BASE_ITEMS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
      aria-label="Hauptnavigation"
    >
      <ul className="glass flex w-full max-w-sm items-center justify-between gap-1 rounded-full p-1.5 shadow-[0_0_0_1px_var(--color-border),var(--shadow-pop)]">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const showDot = item.href === '/me' && !active && unreadCount > 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigator.vibrate?.(6)}
                className={cn(
                  'relative flex h-[3.1rem] flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200',
                  active ? 'text-primary-foreground' : 'text-muted-foreground active:opacity-60',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="dock-platter"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">
                  <Icon
                    className="h-[1.35rem] w-[1.35rem]"
                    strokeWidth={active ? 2.4 : 2}
                    aria-hidden
                  />
                  {showDot && (
                    <span
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-regret ring-2 ring-canvas"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="relative text-[0.625rem] font-semibold tracking-wide">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
