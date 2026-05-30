'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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
          <span className="pl-2 text-[1.0625rem] font-semibold text-label">Wudly</span>
        )}

        <div className="ml-auto flex items-center pr-1">
          {!loading &&
            (user ? (
              <Link
                href="/me"
                className="tap-dim grid h-8 w-8 place-items-center rounded-full bg-fill-2 text-[0.875rem] font-semibold text-label"
                aria-label="Profil"
              >
                {(user.displayName ?? user.email).charAt(0).toUpperCase()}
              </Link>
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
