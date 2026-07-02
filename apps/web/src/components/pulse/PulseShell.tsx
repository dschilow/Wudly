'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ProfessionalProfileDto, PulseAccessDto } from '@wudly/shared';
import {
  Activity,
  ArrowLeft,
  BellRing,
  Boxes,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Swords,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/states/States';

/* ------------------------------------------------------------------ *
 * Context: selected analysis period + the caller's brand profile.
 * ------------------------------------------------------------------ */

interface PulseContextValue {
  profile: ProfessionalProfileDto;
  periodDays: number;
  setPeriodDays: (days: number) => void;
}

const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
  const ctx = useContext(PulseContext);
  if (!ctx) throw new Error('usePulse must be used inside PulseShell');
  return ctx;
}

const PERIODS = [
  { days: 30, label: '30 Tage' },
  { days: 90, label: '90 Tage' },
  { days: 180, label: '180 Tage' },
  { days: 365, label: '1 Jahr' },
];

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/pulse', label: 'Übersicht', icon: LayoutDashboard, exact: true },
  { href: '/pulse/produkte', label: 'Produkte', icon: Boxes },
  { href: '/pulse/signale', label: 'Signale & Warnungen', icon: BellRing },
  { href: '/pulse/wettbewerb', label: 'Wettbewerb', icon: Swords },
  { href: '/pulse/massnahmen', label: 'Maßnahmen & Änderungen', icon: Target },
  { href: '/pulse/feedback', label: 'Kundenfeedback', icon: MessageSquareText },
  { href: '/pulse/reports', label: 'Reports', icon: FileText },
  { href: '/pulse/einstellungen', label: 'Einstellungen', icon: Settings },
];

/**
 * Wudly Pulse shell — the B2B dashboard chrome: a quiet desktop sidebar, a
 * compact topbar with the global period filter, and an access gate that walks
 * new companies to a BRAND/MERCHANT profile first. Content stays calm and
 * data-first; the consumer app chrome is intentionally absent here.
 */
export function PulseShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<PulseAccessDto | null>(null);
  const [checking, setChecking] = useState(true);
  const [periodDays, setPeriodDaysState] = useState(90);

  // Persist the analysis window across visits — it's a working preference.
  useEffect(() => {
    const stored = Number.parseInt(window.localStorage.getItem('wudly.pulse.days') ?? '', 10);
    if (PERIODS.some((p) => p.days === stored)) setPeriodDaysState(stored);
  }, []);
  const setPeriodDays = useCallback((days: number) => {
    setPeriodDaysState(days);
    window.localStorage.setItem('wudly.pulse.days', String(days));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    api.pulse
      .access({ cache: 'no-store' })
      .then(setAccess)
      .catch(() => setAccess({ allowed: false, reason: 'NO_PROFILE', profile: null }))
      .finally(() => setChecking(false));
  }, [user, loading, router, pathname]);

  const ctx = useMemo(
    () =>
      access?.allowed && access.profile
        ? { profile: access.profile, periodDays, setPeriodDays }
        : null,
    [access, periodDays, setPeriodDays],
  );

  if (loading || checking) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-10">
        <PageSkeleton />
      </div>
    );
  }
  if (!user) return null;
  if (!access?.allowed || !ctx) return <PulseOnboarding access={access} />;

  return (
    <PulseContext.Provider value={ctx}>
      <div className="flex min-h-dvh bg-canvas">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-separator bg-surface lg:flex">
          <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
            <LogoMark size={28} />
            <div className="leading-tight">
              <div className="font-display text-[1.05rem] font-bold tracking-tight text-label">
                Wudly <span className="brand-text">Pulse</span>
              </div>
              <div className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-label-3">
                Product Intelligence
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3" aria-label="Pulse-Navigation">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-[0.75rem] px-3 py-2.5 text-[0.9rem] font-medium transition-colors',
                    active
                      ? 'bg-fill-2 text-label'
                      : 'text-muted-foreground hover:bg-fill hover:text-label',
                  )}
                >
                  <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.1} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-separator px-5 py-4">
            <div className="truncate text-[0.85rem] font-semibold text-label">
              {ctx.profile.displayName}
            </div>
            <Link
              href="/"
              className="mt-1 inline-flex items-center gap-1.5 text-[0.8rem] text-muted-foreground hover:text-label"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Zur Wudly-App
            </Link>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <header className="sticky top-0 z-30 border-b border-separator bg-surface/80 backdrop-blur-md">
            <div className="flex h-14 items-center gap-3 px-4 md:px-6">
              <Link href="/pulse" className="flex items-center gap-2 lg:hidden">
                <LogoMark size={24} />
                <span className="font-display text-[0.95rem] font-bold text-label">
                  Wudly <span className="brand-text">Pulse</span>
                </span>
              </Link>
              <div className="hidden items-center gap-2 text-[0.8rem] text-label-3 lg:flex">
                <Activity className="h-4 w-4 text-accent" strokeWidth={2.2} />
                Zeitraum für Trends & Signale
              </div>
              <div className="ml-auto flex items-center gap-1 rounded-full bg-fill-2 p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setPeriodDays(p.days)}
                    className={cn(
                      'rounded-full px-3 py-1 text-[0.8rem] font-medium transition-colors',
                      periodDays === p.days
                        ? 'bg-surface text-label shadow-sm'
                        : 'text-muted-foreground hover:text-label',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Mobile nav row */}
            <nav
              className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden"
              aria-label="Pulse-Navigation"
            >
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-[0.8rem] font-medium',
                      active ? 'bg-primary text-primary-foreground' : 'bg-fill-2 text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </PulseContext.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * Access gate — walks companies to a BRAND/MERCHANT profile first.
 * ------------------------------------------------------------------ */

function PulseOnboarding({ access }: { access: PulseAccessDto | null }) {
  const wrongType = access?.reason === 'WRONG_TYPE';
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div className="card-elevated relative overflow-hidden p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="font-display text-[1.35rem] font-bold tracking-tight text-label">
            Wudly <span className="brand-text">Pulse</span>
          </span>
        </div>
        <h1 className="relative mt-5 text-[1.35rem] font-bold tracking-tight text-label">
          Das Frühwarnsystem für deine Produkte
        </h1>
        <p className="relative mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">
          Wudly Pulse zeigt Herstellern und Händlern, ob Kunden ihre Produkte nach echter
          Nutzung <em>wieder kaufen würden</em> — mit Langzeit-Trends, Frühwarnsignalen,
          Wettbewerbsvergleich und messbaren Maßnahmen.
        </p>
        <p className="relative mt-3 text-[0.9rem] leading-relaxed text-muted-foreground">
          {wrongType
            ? 'Dein aktuelles Profi-Profil ist kein Hersteller- oder Händler-Profil. Pulse ist für Marken, Hersteller und Shops gedacht.'
            : 'Um Pulse zu nutzen, lege zuerst ein professionelles Profil als Hersteller oder Händler an.'}
        </p>
        <Link href="/studio/profil" className="relative mt-5 block">
          <Button fullWidth size="lg" variant="brand">
            {wrongType ? 'Profil im Studio prüfen' : 'Hersteller-/Händler-Profil anlegen'}
          </Button>
        </Link>
        <Link
          href="/"
          className="relative mt-3 block text-center text-[0.85rem] text-muted-foreground hover:text-label"
        >
          Zurück zur Wudly-App
        </Link>
      </div>
    </div>
  );
}
