import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BadgeCheck, Globe, Layers, ShieldAlert } from 'lucide-react';
import { PROFESSIONAL_PROFILE_TYPE_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ShowcaseCard } from '@/components/showcase/ShowcaseCard';
import { EmptyState } from '@/components/states/States';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const profile = await api.showcase.profile(slug, { next: { revalidate: 120 } });
    return {
      title: `${profile.displayName} — Wudly`,
      description: profile.bio ?? undefined,
      robots: { index: false, follow: true },
    };
  } catch {
    return { title: 'Profil' };
  }
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { slug } = await params;

  let profile;
  try {
    profile = await api.showcase.profile(slug, { next: { revalidate: 60 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isVerified = profile.verificationStatus === 'VERIFIED';
  const socials = Object.entries(profile.socialLinks ?? {});

  return (
    <div className="animate-fade space-y-5 pb-8 pt-1">
      <section className="card-elevated relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[1.1rem] bg-fill-2 text-[1.75rem] font-bold text-muted-foreground ring-1 ring-border">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              profile.displayName.charAt(0).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-balance text-[1.5rem] font-bold leading-tight tracking-tight text-label">
                {profile.displayName}
              </h1>
              {isVerified && (
                <BadgeCheck className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.4} aria-label="Verifiziert" />
              )}
            </div>
            <p className="mt-0.5 text-[0.875rem] font-medium text-accent-ink">
              {PROFESSIONAL_PROFILE_TYPE_LABEL[profile.type]}
            </p>
            {profile.bio && (
              <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Paid-partnership disclosure — visible, never hidden. */}
        {profile.paidPartnerships && (
          <div className="relative mt-4 flex items-start gap-2 rounded-[0.9rem] bg-unsure-soft px-3.5 py-2.5 text-[0.8125rem] leading-snug text-unsure-ink">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
            Dieses Profil kann bezahlte Kooperationen veröffentlichen. Kommerzielle Beiträge sind
            jeweils gekennzeichnet.
          </div>
        )}

        {(profile.websiteUrl || socials.length > 0) && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="tap-dim inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-[0.875rem] font-medium text-label"
              >
                <Globe className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
                Website
              </a>
            )}
            {socials.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="tap-dim inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-[0.875rem] font-medium capitalize text-label"
              >
                {key}
              </a>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 px-1 pb-2">
          <Layers className="h-[1.05rem] w-[1.05rem] text-accent" strokeWidth={2.2} aria-hidden />
          <h2 className="text-[1.0625rem] font-bold tracking-tight text-label">
            Showcases · {profile.showcaseCount}
          </h2>
        </div>
        {profile.showcases.length > 0 ? (
          <div className="space-y-2.5">
            {profile.showcases.map((s) => (
              <ShowcaseCard key={s.id} showcase={s} href={`/showcases/${s.id}`} showProduct />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<Layers className="h-7 w-7" strokeWidth={1.8} />}
              title="Noch keine Showcases"
              description="Dieses Profil hat noch keine veröffentlichten Produktseiten."
            />
          </div>
        )}
      </section>

      <p className="px-1 text-center text-[0.75rem] leading-snug text-muted-foreground">
        Showcases sind Hersteller- und Creator-Inhalte. Der neutrale Wudly-Score und die Rankings
        entstehen ausschließlich aus echten Besitzererfahrungen.
      </p>
    </div>
  );
}
