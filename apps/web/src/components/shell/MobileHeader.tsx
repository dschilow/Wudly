'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { Bell, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications-context';

const ROOT_ROUTES = new Set([
  '/',
  '/check',
  '/compare',
  '/rankings',
  '/me/products',
  '/me',
  '/ki-test',
]);
interface DesktopItem {
  href: string;
  label: string;
  match: (p: string) => boolean;
}
const BASE_DESKTOP_ITEMS: DesktopItem[] = [
  {
    href: '/check',
    label: 'Prüfen',
    match: (p: string) =>
      p === '/' || p.startsWith('/check') || p.startsWith('/products') || p.startsWith('/produkte'),
  },
  { href: '/compare', label: 'Vergleichen', match: (p: string) => p.startsWith('/compare') },
  { href: '/rankings', label: 'Entdecken', match: (p: string) => p.startsWith('/rankings') },
  { href: '/me/products', label: 'Besitzen', match: (p: string) => p.startsWith('/me/products') },
  {
    href: '/me',
    label: 'Ich',
    match: (p: string) => p === '/me' || (p.startsWith('/me/') && !p.startsWith('/me/products')),
  },
];
/** Admin-only model benchmarking entry. */
const KI_DESKTOP_ITEM: DesktopItem = {
  href: '/ki-test',
  label: 'KI-Test',
  match: (p: string) => p.startsWith('/ki-test'),
};

function DesktopNav({ pathname, items }: { pathname: string; items: DesktopItem[] }) {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Hauptnavigation">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[0.875rem] font-semibold transition-colors duration-200',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-fill hover:text-label',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Wudly wordmark — Space Grotesk, confident, with one luminous accent point. */
function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-semibold tracking-[-0.03em] text-label', className)}>
      Wudly<span className="text-accent">.</span>
    </span>
  );
}

/** Notifications affordance with a live unread badge — the previously invisible signal. */
function NotificationBell() {
  const { unreadCount } = useNotifications();
  const has = unreadCount > 0;
  return (
    <Link
      href="/me/inbox"
      aria-label={has ? `Mitteilungen, ${unreadCount} ungelesen` : 'Mitteilungen'}
      onClick={() => navigator.vibrate?.(6)}
      className="press relative grid h-9 w-9 place-items-center rounded-full bg-fill text-label-2 transition-colors hover:text-label"
    >
      <Bell className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} aria-hidden />
      {has && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[1.05rem] min-w-[1.05rem] place-items-center rounded-full bg-regret px-1 text-[0.625rem] font-bold leading-none text-white ring-2 ring-canvas">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Verdict masthead. The wordmark is a confident Space Grotesk mark with a single
 * luminous point — calm, premium, unmistakably Wudly. Glass chrome that stays
 * flat at the very top and gains its hairline + denser material once content
 * slides beneath. Root routes carry the notifications bell with its live badge.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const desktopItems =
    user?.role === 'ADMIN' ? [...BASE_DESKTOP_ITEMS, KI_DESKTOP_ITEM] : BASE_DESKTOP_ITEMS;
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12));

  const isRoot = ROOT_ROUTES.has(pathname);

  const chrome = cn(
    'safe-top sticky top-0 z-30 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow] duration-300',
    scrolled ? 'bg-canvas/85 shadow-[0_1px_0_var(--color-separator)]' : 'bg-canvas/50',
  );

  if (!isRoot) {
    return (
      <header className={chrome}>
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-2 md:px-5">
          <button
            onClick={() => router.back()}
            className="tap-dim -ml-1 flex items-center gap-0.5 pr-2 text-[1.0625rem] font-medium text-accent-ink"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-[1.5rem] w-[1.5rem]" strokeWidth={2.4} />
            <span>Zurück</span>
          </button>
          <Link href="/check" className="tap-dim" aria-label="Wudly — Startseite">
            <Wordmark className="text-[1.2rem]" />
          </Link>
          <div className="flex items-center gap-2">
            <DesktopNav pathname={pathname} items={desktopItems} />
            {user && <NotificationBell />}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={chrome}>
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/check" className="tap-dim" aria-label="Wudly — Startseite">
          <Wordmark className="text-[1.6rem]" />
        </Link>
        <div className="flex items-center gap-2">
          <DesktopNav pathname={pathname} items={desktopItems} />
          {user && <NotificationBell />}
        </div>
      </div>
    </header>
  );
}
