'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ChevronRight,
  LogOut,
  MessageCircle,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
} from 'lucide-react';
import { WouldBuyAgain, type ExperienceDto, type ProfileSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { WaveLines } from '@/components/motion/WaveLines';
import { Barcode } from '@/components/receipt/Barcode';
import { LedgerRow } from '@/components/receipt/LedgerRow';
import { Stamp } from '@/components/receipt/Stamp';
import { PageSkeleton } from '@/components/states/States';
import { cn } from '@/lib/utils';

const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function ListItem({
  icon: Icon,
  label,
  subtitle,
  href,
  tone = 'positive',
}: {
  icon: typeof Star;
  label: string;
  subtitle?: string;
  href: string;
  tone?: 'positive' | 'regret' | 'accent';
}) {
  const colors = {
    positive: 'bg-positive-soft text-positive-ink',
    regret: 'bg-regret-soft text-regret-ink',
    accent: 'bg-accent-soft text-accent-ink',
  };
  return (
    <Link
      href={href}
      className="tap hairline flex items-center gap-3.5 px-4 py-3.5 last:after:hidden"
    >
      <span
        className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[0.7rem]', colors[tone])}
      >
        <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-semibold leading-tight text-label">
          {label}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[0.875rem] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-label-3" strokeWidth={2.3} />
    </Link>
  );
}

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

  const rebuyRate = useMemo(() => {
    if (experiences.length === 0) return null;
    const yes = experiences.filter(
      (experience) => experience.wouldBuyAgain === WouldBuyAgain.YES,
    ).length;
    return Math.round((yes / experiences.length) * 100);
  }, [experiences]);

  if (loading || (!user && dataLoading)) return <PageSkeleton />;
  if (!user) return null;

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-6 pt-4"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      <motion.section variants={rise}>
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Ich
        </p>
        <h1 className="font-display mt-2.5 text-[3rem] leading-[1.0] text-label">
          Dein <em className="text-accent-ink">Kaufprofil</em>
        </h1>
      </motion.section>

      {/* The Kaufprofil as a Kassenbon — the shareable artifact. */}
      <motion.section variants={rise}>
        <div className="card perf-bottom relative">
          <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-[45%] text-accent">
              <WaveLines opacity={0.09} />
            </div>

            <div className="relative px-5 pt-4">
              <div className="flex items-center justify-between">
                <span className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Rebuy-Profil
                </span>
                <span className="mono-data text-[0.6875rem] uppercase tracking-[0.14em] text-faint">
                  Seit {new Date(user.createdAt).getFullYear()}
                </span>
              </div>

              <div className="mt-1 flex items-end justify-between gap-3">
                {rebuyRate === null ? (
                  <p className="font-display text-[4.6rem] leading-[0.95] text-label-3">–</p>
                ) : (
                  <p className="font-display text-[4.6rem] leading-[0.95] text-label">
                    <AnimatedNumber value={rebuyRate} duration={1.1} />
                    <span className="text-[2.3rem]">%</span>
                  </p>
                )}
                <div className="pb-3">
                  <Stamp
                    tone={rebuyRate === null ? 'neutral' : rebuyRate >= 70 ? 'positive' : 'unsure'}
                  >
                    {rebuyRate === null
                      ? 'Noch offen'
                      : rebuyRate >= 70
                        ? 'Gute Käufe'
                        : 'Gemischt'}
                  </Stamp>
                </div>
              </div>
              <p className="font-display mt-1 text-[1.2rem] italic leading-snug text-ink-soft">
                {rebuyRate === null
                  ? 'Teile deine erste Erfahrung, dann entsteht dein Kaufprofil.'
                  : 'deiner Produkte würdest du wieder kaufen.'}
              </p>
            </div>

            <div className="rule-dashed relative mx-5 mt-4" aria-hidden />

            <div className="relative space-y-2 px-5 pb-4 pt-4">
              <LedgerRow label="Produkte" value={summary?.productCount ?? 0} />
              <LedgerRow label="Erfahrungen" value={summary?.experienceCount ?? 0} />
              <LedgerRow label="Antworten" value={summary?.answerCount ?? 0} />
              <LedgerRow label="Käufern geholfen" value={summary?.helpfulReceived ?? 0} strong />
            </div>

            <div className="relative px-5 pb-5">
              <Barcode seed={user.id} className="h-6 text-label/70" />
              <p className="mono-data mt-1.5 text-center text-[0.625rem] uppercase tracking-[0.3em] text-faint">
                Wudly Kaufprofil
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section className="card overflow-hidden" variants={rise}>
        <ListItem
          icon={Star}
          label="Meine Top-Käufe"
          subtitle="Produkte, die sich wirklich gelohnt haben"
          href="/me/products"
        />
        <ListItem
          icon={ShoppingBag}
          label="Meine Fehlkäufe"
          subtitle="Produkte, die enttäuscht haben"
          href="/me/products"
          tone="regret"
        />
        <ListItem
          icon={MessageCircle}
          label="Meine Antworten"
          subtitle="Fragen, die du beantwortet hast"
          href="/me/inbox"
          tone="accent"
        />
        <ListItem
          icon={Share2}
          label="Profilkarte teilen"
          subtitle="Dein Kaufprofil als Karte"
          href="/me"
          tone="accent"
        />
      </motion.section>

      <motion.section className="card flex items-center gap-4 p-4" variants={rise}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
          <Users className="h-6 w-6" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Dein Einfluss
          </p>
          <p className="mt-0.5 text-[1rem] leading-snug text-label">
            Deine Antworten helfen anderen, bessere Käufe zu machen.
          </p>
        </div>
      </motion.section>

      {user.role === 'ADMIN' && (
        <motion.section className="card overflow-hidden" variants={rise}>
          <ListItem
            icon={ShieldCheck}
            label="Admin-Bereich"
            subtitle="Produkte, Bilder, Bewertungen verwalten"
            href="/admin"
            tone="accent"
          />
        </motion.section>
      )}

      <motion.section variants={rise} className="flex flex-wrap gap-x-4 gap-y-1.5 px-4">
        <Link href="/impressum" className="text-[0.8125rem] text-muted-foreground">
          Impressum
        </Link>
        <Link href="/datenschutz" className="text-[0.8125rem] text-muted-foreground">
          Datenschutz
        </Link>
        <Link href="/agb" className="text-[0.8125rem] text-muted-foreground">
          AGB
        </Link>
      </motion.section>

      <motion.section variants={rise}>
        <button
          onClick={async () => {
            await logout();
            router.replace('/login');
          }}
          className="flex w-full items-center gap-3.5 rounded-[var(--radius-lg)] px-4 py-3.5 text-left text-regret-ink active:opacity-60"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.7rem] bg-regret-soft">
            <LogOut className="h-[1.35rem] w-[1.35rem]" strokeWidth={2.1} />
          </span>
          <span className="text-[1.0625rem] font-semibold leading-tight">Abmelden</span>
        </button>
      </motion.section>
    </motion.div>
  );
}
