'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PROFESSIONAL_PROFILE_TYPE_LABEL,
  type ProfessionalProfileDto,
  type ShowcaseSummaryDto,
} from '@wudly/shared';
import {
  BadgeCheck,
  ChevronRight,
  ExternalLink,
  Layers,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DisclosureBadge } from '@/components/DisclosureBadge';
import { PageSkeleton, ListSkeleton, EmptyState } from '@/components/states/States';

interface StatusMeta {
  label: string;
  cls: string;
}
const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: 'Entwurf', cls: 'bg-fill-2 text-muted-foreground' },
  PUBLISHED: { label: 'Veröffentlicht', cls: 'bg-positive-soft text-positive-ink' },
  ARCHIVED: { label: 'Archiviert', cls: 'bg-fill-2 text-label-3' },
};
const DEFAULT_STATUS: StatusMeta = { label: 'Entwurf', cls: 'bg-fill-2 text-muted-foreground' };

export function StudioClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfileDto | null>(null);
  const [showcases, setShowcases] = useState<ShowcaseSummaryDto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/studio');
      return;
    }
    Promise.all([
      api.showcase.myProfile({ cache: 'no-store' }),
      api.showcase.mine({ cache: 'no-store' }).catch(() => [] as ShowcaseSummaryDto[]),
    ])
      .then(([p, s]) => {
        setProfile(p);
        setShowcases(s);
      })
      .catch(() => undefined)
      .finally(() => setDataLoading(false));
  }, [user, loading, router]);

  if (loading || (!user && dataLoading)) return <PageSkeleton />;
  if (!user) return null;

  // No professional profile yet → onboarding entry.
  if (!dataLoading && !profile) {
    return (
      <div className="animate-fade space-y-5 pb-8 pt-2">
        <header className="px-1">
          <h1 className="text-[1.625rem] font-bold tracking-tight text-label">Creator-Studio</h1>
          <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
            Präsentiere Produkte als Creator, Tester oder Hersteller — klar gekennzeichnet und
            getrennt vom neutralen Wudly-Score.
          </p>
        </header>

        <section className="card-elevated relative overflow-hidden p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-accent-soft blur-3xl"
          />
          <span className="relative grid h-12 w-12 place-items-center rounded-[1rem] bg-accent-soft text-accent">
            <Sparkles className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <h2 className="relative mt-4 text-[1.25rem] font-bold tracking-tight text-label">
            Werde Profi auf Wudly
          </h2>
          <p className="relative mt-1.5 text-[0.9375rem] leading-snug text-muted-foreground">
            Lege ein professionelles Profil an, um eigene Produktseiten („Showcases") zu
            veröffentlichen. Deine Inhalte beeinflussen niemals den neutralen Score.
          </p>
          <Link href="/studio/profil" className="relative mt-4 block">
            <Button fullWidth size="lg">
              Profi-Profil anlegen
            </Button>
          </Link>
        </section>

        <ul className="space-y-2 px-1 text-[0.875rem] text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-accent">•</span> Eigene Marken-/Creator-Seite unter
            wudly.app/creator/…
          </li>
          <li className="flex gap-2">
            <span className="text-accent">•</span> Block-Baukasten mit Vorlagen je Kategorie
          </li>
          <li className="flex gap-2">
            <span className="text-accent">•</span> Pflicht-Transparenz: jede Kooperation wird
            sichtbar gekennzeichnet
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-5 pb-8 pt-2">
      {/* Profile header */}
      {profile && (
        <section className="card-elevated relative overflow-hidden p-4">
          <div className="flex items-start gap-3.5">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[1rem] bg-fill-2 text-[1.375rem] font-bold text-muted-foreground ring-1 ring-border">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                profile.displayName.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[1.25rem] font-bold tracking-tight text-label">
                  {profile.displayName}
                </h1>
                {profile.verificationStatus === 'VERIFIED' && (
                  <BadgeCheck
                    className="h-[1.1rem] w-[1.1rem] shrink-0 text-accent"
                    strokeWidth={2.4}
                    aria-label="Verifiziert"
                  />
                )}
              </div>
              <p className="text-[0.875rem] font-medium text-accent-ink">
                {PROFESSIONAL_PROFILE_TYPE_LABEL[profile.type]}
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex gap-2">
            <Link href="/studio/profil" className="flex-1">
              <Button variant="gray" size="sm" fullWidth>
                <Pencil className="h-[0.95rem] w-[0.95rem]" strokeWidth={2.3} />
                Profil bearbeiten
              </Button>
            </Link>
            <Link href={`/creator/${profile.slug}`} className="flex-1">
              <Button variant="gray" size="sm" fullWidth>
                <ExternalLink className="h-[0.95rem] w-[0.95rem]" strokeWidth={2.3} />
                Öffentlich ansehen
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Showcases */}
      <section>
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="h-[1.05rem] w-[1.05rem] text-accent" strokeWidth={2.2} aria-hidden />
            <h2 className="text-[1.0625rem] font-bold tracking-tight text-label">
              Meine Showcases
            </h2>
          </div>
          <Link href="/studio/neu">
            <Button size="sm">
              <Plus className="h-[1rem] w-[1rem]" strokeWidth={2.6} />
              Neu
            </Button>
          </Link>
        </div>

        {dataLoading ? (
          <ListSkeleton rows={2} />
        ) : showcases.length > 0 ? (
          <div className="space-y-2.5">
            {showcases.map((s) => {
              const status = STATUS_META[s.status] ?? DEFAULT_STATUS;
              return (
                <Link
                  key={s.id}
                  href={`/studio/showcases/${s.id}`}
                  className="press card flex items-center gap-3 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                          status.cls,
                        )}
                      >
                        {status.label}
                      </span>
                      <DisclosureBadge type={s.disclosureType} size="sm" />
                    </div>
                    <p className="mt-1.5 truncate text-[1.0625rem] font-semibold text-label">
                      {s.title}
                    </p>
                    <p className="truncate text-[0.8125rem] text-muted-foreground">
                      {s.product?.canonicalName ?? 'Produkt'} · {s.blockCount} Blöcke
                    </p>
                  </div>
                  <ChevronRight
                    className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
                    strokeWidth={2.5}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<Layers className="h-7 w-7" strokeWidth={1.8} />}
              title="Noch keine Showcases"
              description="Erstelle deine erste Produktseite mit dem Block-Baukasten."
              action={
                <Link href="/studio/neu">
                  <Button>Showcase erstellen</Button>
                </Link>
              }
            />
          </div>
        )}
      </section>

      <p className="px-1 text-center text-[0.75rem] leading-snug text-muted-foreground">
        Showcases sind klar gekennzeichnete Hersteller-/Creator-Inhalte. Der neutrale Wudly-Score
        und die Rankings entstehen ausschließlich aus echten Besitzererfahrungen.
      </p>
    </div>
  );
}
