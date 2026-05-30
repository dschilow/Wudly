'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProfileSummaryDto, ExperienceDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Package, Star, MessageSquare, ThumbsUp, PartyPopper, Wrench, Plus, LogOut } from 'lucide-react';
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
    { label: 'Produkte', value: summary?.productCount ?? 0, icon: Package },
    { label: 'Erfahrungen', value: summary?.experienceCount ?? 0, icon: Star },
    { label: 'Antworten', value: summary?.answerCount ?? 0, icon: MessageSquare },
    { label: 'Hilfreich', value: summary?.helpfulReceived ?? 0, icon: ThumbsUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-[var(--radius-lg)] bg-accent-soft text-2xl font-black text-accent-ink ring-1 ring-accent/10">
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
          <Card key={s.label} padded={false} className="px-2 py-3.5 text-center">
            <s.icon className="mx-auto h-[1.1rem] w-[1.1rem] text-faint" strokeWidth={2} aria-hidden />
            <div className="mt-1 text-xl font-extrabold tnum text-ink">{s.value}</div>
            <div className="text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Impact note */}
      {(summary?.helpfulReceived ?? 0) > 0 && (
        <Card className="flex items-center gap-3 bg-positive-soft/50">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-positive/10 text-positive-ink">
            <PartyPopper className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
          </div>
          <p className="text-sm font-semibold text-positive-ink">
            Deine Beiträge wurden {summary?.helpfulReceived}× als hilfreich markiert!
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/me/products">
          <Button variant="secondary" fullWidth>
            Meine Produkte
          </Button>
        </Link>
        <Link href="/check?own=1">
          <Button fullWidth>
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Erfahrung
          </Button>
        </Link>
      </div>

      {user.role === 'ADMIN' && (
        <Link href="/admin">
          <Button variant="outline" fullWidth>
            <Wrench className="h-4 w-4" strokeWidth={2} /> Admin-Bereich
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
            icon={Star}
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
        className="mx-auto flex items-center gap-1.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-regret-ink"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} /> Abmelden
      </button>
    </div>
  );
}
