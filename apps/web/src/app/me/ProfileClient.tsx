'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProfileSummaryDto, ExperienceDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ExperienceCard } from '@/components/ExperienceCard';
import { LoadingState, EmptyState } from '@/components/states/States';

export function ProfileClient() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [summary, setSummary] = useState<ProfileSummaryDto | null>(null);
  const [experiences, setExperiences] = useState<ExperienceDto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/me');
      return;
    }
    Promise.all([
      api.profile.summary({ cache: 'no-store' }),
      api.experiences.mine({ cache: 'no-store' }),
    ])
      .then(([s, e]) => {
        setSummary(s);
        setExperiences(e);
      })
      .catch(() => undefined)
      .finally(() => setDataLoading(false));
  }, [user, loading, router]);

  if (loading || (!user && dataLoading)) return <LoadingState />;
  if (!user) return null;

  const stats = [
    { label: 'Produkte', value: summary?.productCount ?? 0 },
    { label: 'Erfahrungen', value: summary?.experienceCount ?? 0 },
    { label: 'Antworten', value: summary?.answerCount ?? 0 },
    { label: 'Hilfreich', value: summary?.helpfulReceived ?? 0 },
  ];

  return (
    <div className="animate-fade space-y-6 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3.5 px-1 pt-1">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-fill-2 text-[1.75rem] font-medium text-muted-foreground">
          {(user.displayName ?? user.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.625rem] font-bold tracking-tight text-label">
            {user.displayName ?? 'Profil'}
          </h1>
          <p className="truncate text-[0.9375rem] text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Stats — 4-up grouped card with hairline dividers */}
      <div className="grid grid-cols-4 overflow-hidden rounded-[var(--radius-lg)] bg-surface">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn('px-1 py-4 text-center', i < stats.length - 1 && 'border-r border-separator')}
          >
            <div className="text-[1.5rem] font-semibold tnum leading-none text-label">{s.value}</div>
            <div className="mt-1 text-[0.6875rem] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {(summary?.helpfulReceived ?? 0) > 0 && (
        <p className="px-1 text-[0.9375rem] text-positive-ink">
          Deine Beiträge wurden {summary?.helpfulReceived}× als hilfreich markiert.
        </p>
      )}

      {/* Actions as an iOS list group */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
        <Link href="/check?own=1" className="tap hairline flex items-center justify-between px-4 py-3">
          <span className="text-[1.0625rem] text-label">Erfahrung teilen</span>
          <ChevronRight className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3" strokeWidth={2.5} />
        </Link>
        <Link
          href="/me/products"
          className={cn(
            'tap flex items-center justify-between px-4 py-3',
            user.role === 'ADMIN' && 'hairline',
          )}
        >
          <span className="text-[1.0625rem] text-label">Meine Produkte</span>
          <ChevronRight className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3" strokeWidth={2.5} />
        </Link>
        {user.role === 'ADMIN' && (
          <Link href="/admin" className="tap flex items-center justify-between px-4 py-3">
            <span className="text-[1.0625rem] text-label">Admin-Bereich</span>
            <ChevronRight className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3" strokeWidth={2.5} />
          </Link>
        )}
      </div>

      {/* My experiences */}
      <section>
        <h2 className="px-1 pb-1.5 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
          Meine Erfahrungen
        </h2>
        {dataLoading ? (
          <LoadingState />
        ) : experiences.length > 0 ? (
          <div className="space-y-2.5">
            {experiences.map((e) => (
              <ExperienceCard key={e.id} experience={e} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] bg-surface">
            <EmptyState
              title="Noch keine Erfahrungen"
              description="Teile dein erstes Produkt und hilf anderen."
              action={
                <Link href="/check?own=1">
                  <Button>Erfahrung teilen</Button>
                </Link>
              }
            />
          </div>
        )}
      </section>

      {/* Sign out — its own group, destructive, centered (iOS) */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
        <button
          onClick={async () => {
            await logout();
            router.push('/');
          }}
          className="tap w-full py-3 text-center text-[1.0625rem] text-regret"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}
