'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

/** Top app bar: brand on home, back button on deeper routes, auth shortcut. */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isHome = pathname === '/';
  const showBack = !isHome && pathname !== '/check' && pathname !== '/rankings' && pathname !== '/me';

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface-muted/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-card ring-1 ring-border"
            aria-label="Zurück"
          >
            ←
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-base font-black text-white">
              W
            </span>
            <span className="text-lg font-extrabold tracking-tight text-ink">Wudly</span>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/rankings"
            className={cn(
              'hidden rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-ink md:block',
            )}
          >
            Top &amp; Flop
          </Link>
          {!loading &&
            (user ? (
              <Link
                href="/me"
                className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent"
                aria-label="Profil"
              >
                {(user.displayName ?? user.email).charAt(0).toUpperCase()}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white"
              >
                Anmelden
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
