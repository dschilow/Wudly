'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { LogoWord } from '@/components/Logo';

const ROOT_ROUTES = new Set(['/', '/check', '/rankings', '/me']);

/** Top app bar: brand on root routes, back button on deeper routes, auth shortcut. */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const showBack = !ROOT_ROUTES.has(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-xs ring-1 ring-border transition-colors hover:bg-surface-sunken"
            aria-label="Zurück"
          >
            <ArrowLeft className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} />
          </button>
        ) : (
          <Link href="/" className="transition-opacity hover:opacity-80">
            <LogoWord />
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/rankings"
            className="hidden rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-ink md:block"
          >
            Top &amp; Flop
          </Link>
          {!loading &&
            (user ? (
              <Link
                href="/me"
                className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-ink ring-1 ring-accent/10 transition-transform active:scale-95"
                aria-label="Profil"
              >
                {(user.displayName ?? user.email).charAt(0).toUpperCase()}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
              >
                Anmelden
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
