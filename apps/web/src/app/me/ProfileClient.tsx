'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProfileSummaryDto, ExperienceDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';
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
    { label: 'Produkte', value: summary?.productCount ?? 0, icon: '📦' },
    { label: 'Erfahrungen', value: summary?.experienceCount ?? 0, icon: '⭐' },
    { label: 'Antworten', value: summary?.answerCount ?? 0, icon: '💬' },
    { label: 'Hilfreich', value: summary?.helpfulReceived ?? 0, icon: '👍' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-2xl font-black text-accent">
          {(user.displayName ?? user.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-ink">
            {user.displayName ?? 'Mein Profil'}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <Card key={s.label} padded={false} className="px-2 py-3 text-center">
            <div className="text-lg" aria-hidden>
              {s.icon}
            </div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-ink">{s.value}</div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Impact note */}
      {(summary?.helpfulReceived ?? 0) > 0 && (
        <Card className="bg-positive-soft/50 text-center">
          <p className="text-sm font-semibold text-positive-ink">
            🎉 Deine Beiträge wurden {summary?.helpfulReceived}× als hilfreich markiert!
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/me/products">
          <Button variant="secondary" fullWidth>
            Meine Produkte
          </Button>
        </Link>
        <Link href="/check?own=1">
          <Button fullWidth>+ Erfahrung</Button>
        </Link>
      </div>

      {user.role === 'ADMIN' && (
        <Link href="/admin">
          <Button variant="outline" fullWidth>
            🛠️ Admin-Bereich
          </Button>
        </Link>
      )}

      {/* My experiences */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Meine Erfahrungen</h2>
        {dataLoading ? (
          <LoadingState />
        ) : experiences.length > 0 ? (
          <div className="space-y-3">
            {experiences.map((e) => (
              <ExperienceCard key={e.id} experience={e} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="⭐"
            title="Noch keine Erfahrungen"
            description="Teile dein erstes Produkt und hilf anderen."
            action={
              <Link href="/check?own=1">
                <Button>Erfahrung teilen</Button>
              </Link>
            }
          />
        )}
      </section>

      <button
        onClick={async () => {
          await logout();
          router.push('/');
        }}
        className="mx-auto block py-2 text-sm font-semibold text-muted-foreground hover:text-regret-ink"
      >
        Abmelden
      </button>
    </div>
  );
}
