'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications-context';
import { LogoWord } from '@/components/Logo';

const ROOT_ROUTES = new Set(['/', '/check', '/rankings', '/me']);

/**
 * iOS navigation bar: translucent material, a blue back chevron + "Zurück" on deep
 * routes, and a compact brand/auth affordance on root routes. Page content
 * provides its own large title (iOS Large Title pattern), so this bar stays minimal.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { unreadCount } = useNotifications();

  const isRoot = ROOT_ROUTES.has(pathname);

  return (
    <header className="safe-top sticky top-0 z-30 bg-canvas/80 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-11 max-w-3xl items-center px-2">
        {!isRoot ? (
          <button
            onClick={() => router.back()}
            className="tap-dim -ml-1 flex items-center gap-0.5 pr-2 text-[1.0625rem] text-accent"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-[1.5rem] w-[1.5rem]" strokeWidth={2.4} />
            <span className="font-normal">Zurück</span>
          </button>
        ) : (
          <Link href="/" className="tap-dim pl-1.5" aria-label="Wudly Start">
            <LogoWord />
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5 pr-1">
          {!loading &&
            (user ? (
              <>
                <Link
                  href="/me/inbox"
                  className="tap-dim relative grid h-8 w-8 place-items-center rounded-full text-label"
                  aria-label={
                    unreadCount > 0
                      ? `Mitteilungen, ${unreadCount} ungelesen`
                      : 'Mitteilungen'
                  }
                >
                  <Bell className="h-[1.3rem] w-[1.3rem]" strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 grid h-[1.05rem] min-w-[1.05rem] place-items-center rounded-full bg-regret px-1 text-[0.625rem] font-bold leading-none text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/me"
                  className="tap-dim grid h-8 w-8 place-items-center rounded-full bg-fill-2 text-[0.875rem] font-semibold text-label"
                  aria-label="Profil"
                >
                  {(user.displayName ?? user.email).charAt(0).toUpperCase()}
                </Link>
              </>
            ) : (
              <Link href="/login" className="tap-dim px-2 text-[1.0625rem] font-normal text-accent">
                Anmelden
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
