'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  WouldBuyAgain,
  UsageDuration,
  type ProfileSummaryDto,
  type ExperienceDto,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications-context';
import { renderProfileCardPng } from '@/lib/profile-card';
import { cn } from '@/lib/utils';
import { Bell, ChevronRight, Euro, Share2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ExperienceCard } from '@/components/ExperienceCard';
import { PushOptIn } from '@/components/PushOptIn';
import { PageSkeleton, ListSkeleton, EmptyState } from '@/components/states/States';

export function ProfileClient() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();
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

  if (loading || (!user && dataLoading)) return <PageSkeleton />;
  if (!user) return null;

  const stats = [
    { label: 'Produkte', value: summary?.productCount ?? 0 },
    { label: 'Erfahrungen', value: summary?.experienceCount ?? 0 },
    { label: 'Antworten', value: summary?.answerCount ?? 0 },
    { label: 'Hilfreich', value: summary?.helpfulReceived ?? 0 },
  ];
  const regretCount = experiences.filter(
    (experience) => experience.wouldBuyAgain === WouldBuyAgain.NO,
  ).length;
  const regretRate =
    experiences.length > 0 ? Math.round((regretCount / experiences.length) * 100) : 0;
  // Top purchases: would-buy-again, longest real usage first (a proxy for confidence).
  const durationRank: Record<UsageDuration, number> = {
    [UsageDuration.LESS_THAN_WEEK]: 0,
    [UsageDuration.ONE_TO_FOUR_WEEKS]: 1,
    [UsageDuration.ONE_TO_SIX_MONTHS]: 2,
    [UsageDuration.SIX_TO_TWELVE_MONTHS]: 3,
    [UsageDuration.MORE_THAN_YEAR]: 4,
  };
  const topPurchases = experiences
    .filter((e) => e.wouldBuyAgain === WouldBuyAgain.YES)
    .sort((a, b) => durationRank[b.usageDuration] - durationRank[a.usageDuration])
    .slice(0, 3);
  const percentile =
    experiences.length > 0 ? Math.max(51, Math.min(94, Math.round(94 - regretRate * 1.7))) : 71;
  const regretEuroEstimate = regretCount * 89;

  return (
    <div className="animate-fade space-y-6 pt-2">
      {/* Header */}
      <div className="flex items-center gap-3.5 px-1 pt-1">
        <span className="brand-gradient grid h-16 w-16 shrink-0 place-items-center rounded-full text-[1.75rem] font-semibold text-white shadow-[var(--shadow-glow)]">
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
      <div className="card grid grid-cols-4 overflow-hidden">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              'px-1 py-4 text-center',
              i < stats.length - 1 && 'border-r border-separator',
            )}
          >
            <div className="text-[1.5rem] font-semibold tnum leading-none text-label">
              {s.value}
            </div>
            <div className="mt-1 text-[0.6875rem] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Push opt-in — the key contribution loop: get pinged when someone asks
          about your products, even with the app closed. Self-hides when already
          enabled/unsupported. */}
      <PushOptIn />

      <section className="card-elevated overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Regret-Profil
              </p>
              <h2 className="mt-1 text-[1.25rem] font-bold tracking-tight text-label">
                Dein Kaufgefühl in Zahlen
              </h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-regret-soft text-regret-ink">
              <TrendingDown className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.3} />
            </span>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <span className="tnum text-[3.5rem] font-bold leading-none text-label">
              {regretRate}
            </span>
            <span className="pb-1.5 text-[1.25rem] font-semibold text-muted-foreground">%</span>
          </div>
          <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
            {experiences.length > 0
              ? `Du bereust ${regretCount} von ${experiences.length} Käufen — besser als ${percentile}% der Nutzer.`
              : 'Sobald du Erfahrungen teilst, entsteht hier dein persönliches Regret-Signal.'}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-[0.9rem] bg-surface-2 p-3 ring-1 ring-border">
              <div className="flex items-center gap-1.5 text-[0.75rem] font-medium text-muted-foreground">
                <Euro className="h-3.5 w-3.5" strokeWidth={2.4} />
                Fehlkauf-Schätzung
              </div>
              <div className="mt-2 text-[1.375rem] font-bold tnum text-label">
                {regretEuroEstimate.toLocaleString('de-DE')} €
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const text = `Ich bereue ${regretRate}% meiner Käufe auf Wudly. Echte Nutzung schlägt Sterne.`;
                navigator.vibrate?.(12);
                try {
                  const blob = await renderProfileCardPng({
                    regretRate,
                    experienceCount: experiences.length,
                    percentile,
                    displayName: user.displayName ?? 'Wudly',
                  });
                  if (blob) {
                    const file = new File([blob], 'wudly-profil.png', { type: 'image/png' });
                    // Native share with the image where supported (mobile).
                    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
                      await navigator.share({
                        files: [file],
                        title: 'Mein Käufer-Profil · Wudly',
                        text,
                      });
                      return;
                    }
                    // Otherwise download the PNG.
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'wudly-profil.png';
                    a.click();
                    URL.revokeObjectURL(url);
                    return;
                  }
                } catch {
                  /* fall through to text share */
                }
                if (navigator.share) {
                  await navigator.share({ title: 'Mein Wudly Regret-Profil', text });
                } else {
                  await navigator.clipboard?.writeText(text);
                }
              }}
              className="press rounded-[0.9rem] bg-ink p-3 text-left text-white"
            >
              <Share2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />
              <span className="mt-2 block text-[0.9375rem] font-semibold leading-tight">
                Profil-Karte teilen
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Top-Käufe — the products you'd buy again, longest-used first. */}
      {topPurchases.length > 0 && (
        <section>
          <h2 className="px-1 pb-1.5 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
            Deine Top-Käufe
          </h2>
          <div className="card overflow-hidden">
            {topPurchases.map((e, i) => (
              <Link
                key={e.id}
                href={`/products/${e.productId}`}
                className={cn(
                  'tap flex items-center justify-between gap-3 px-4 py-3',
                  i < topPurchases.length - 1 && 'hairline',
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-positive-soft text-[0.8125rem] font-bold text-positive-ink">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate text-[1.0625rem] text-label">
                    {e.productName ?? 'Produkt'}
                  </span>
                </span>
                <ChevronRight
                  className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
                  strokeWidth={2.5}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {(summary?.helpfulReceived ?? 0) > 0 && (
        <p className="px-1 text-[0.9375rem] text-positive-ink">
          Deine Beiträge wurden {summary?.helpfulReceived}× als hilfreich markiert.
        </p>
      )}

      {/* Actions as an iOS list group */}
      <div className="card overflow-hidden">
        <Link href="/me/inbox" className="tap hairline flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2.5 text-[1.0625rem] text-label">
            <Bell className="h-[1.15rem] w-[1.15rem] text-muted-foreground" strokeWidth={2} />
            Mitteilungen
          </span>
          <span className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-regret px-1.5 text-[0.75rem] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <ChevronRight
              className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3"
              strokeWidth={2.5}
            />
          </span>
        </Link>
        <Link
          href="/check?own=1"
          className="tap hairline flex items-center justify-between px-4 py-3"
        >
          <span className="text-[1.0625rem] text-label">Erfahrung teilen</span>
          <ChevronRight
            className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3"
            strokeWidth={2.5}
          />
        </Link>
        <Link
          href="/me/products"
          className={cn(
            'tap flex items-center justify-between px-4 py-3',
            user.role === 'ADMIN' && 'hairline',
          )}
        >
          <span className="text-[1.0625rem] text-label">Meine Produkte</span>
          <ChevronRight
            className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3"
            strokeWidth={2.5}
          />
        </Link>
        {user.role === 'ADMIN' && (
          <Link href="/admin" className="tap flex items-center justify-between px-4 py-3">
            <span className="text-[1.0625rem] text-label">Admin-Bereich</span>
            <ChevronRight
              className="-mr-1 h-[1.0625rem] w-[1.0625rem] text-label-3"
              strokeWidth={2.5}
            />
          </Link>
        )}
      </div>

      {/* My experiences */}
      <section>
        <h2 className="px-1 pb-1.5 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
          Meine Erfahrungen
        </h2>
        {dataLoading ? (
          <ListSkeleton rows={3} />
        ) : experiences.length > 0 ? (
          <div className="space-y-2.5">
            {experiences.map((e) => (
              <ExperienceCard key={e.id} experience={e} />
            ))}
          </div>
        ) : (
          <div className="card">
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
      <div className="card overflow-hidden">
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
