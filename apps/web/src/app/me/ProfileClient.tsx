'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView, useReducedMotion } from 'motion/react';
import {
  ChevronRight,
  MessageCircle,
  Settings,
  Share2,
  ShoppingBag,
  Star,
  ThumbsDown,
  Users,
} from 'lucide-react';
import { WouldBuyAgain, type ExperienceDto, type ProfileSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { PageSkeleton } from '@/components/states/States';
import { cn } from '@/lib/utils';

function Stat({ value, label, divider }: { value: number; label: string; divider?: boolean }) {
  return (
    <div className={cn('px-1 py-4 text-center', divider && 'border-r border-separator')}>
      <div className="tnum text-[1.75rem] font-semibold leading-none text-accent">
        <AnimatedNumber value={value} duration={0.8} />
      </div>
      <div className="mt-1.5 text-[0.8125rem] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

/** The personal rebuy gauge — a gradient arc that draws in, number counting up. */
function RebuyRing({ value }: { value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  const stroke = 10;
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const active = reduced || inView ? Math.max(0, Math.min(100, value)) : 0;
  const dashOffset = circumference * (1 - active / 100);

  return (
    <div ref={ref} className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <defs>
          <linearGradient id="rebuy-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-positive)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--color-positive)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-fill-2)"
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#rebuy-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.2s var(--ease-ios) 0.1s' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="tnum text-[2.35rem] font-semibold leading-none text-accent">
          <AnimatedNumber value={value} duration={1.1} />
          <span className="text-[0.55em]">%</span>
        </span>
      </div>
    </div>
  );
}

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
    <Link href={href} className="tap hairline flex items-center gap-4 px-4 py-4 last:after:hidden">
      <span
        className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-[0.85rem]', colors[tone])}
      >
        <Icon className="h-6 w-6" strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.1875rem] font-semibold leading-tight text-label">
          {label}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[0.9375rem] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      <ChevronRight className="h-6 w-6 shrink-0 text-label-3" strokeWidth={2.3} />
    </Link>
  );
}

export function ProfileClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
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
    if (experiences.length === 0) return 72;
    const yes = experiences.filter(
      (experience) => experience.wouldBuyAgain === WouldBuyAgain.YES,
    ).length;
    return Math.round((yes / experiences.length) * 100);
  }, [experiences]);

  if (loading || (!user && dataLoading)) return <PageSkeleton />;
  if (!user) return null;

  return (
    <motion.div
      className="space-y-7 pt-2"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.section
        className="flex items-start justify-between gap-4"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        <div>
          <h1 className="font-display text-[3rem] font-semibold leading-none text-label">Ich</h1>
          <p className="mt-2.5 text-[1.3rem] leading-tight text-muted-foreground">
            Dein Kaufprofil
          </p>
        </div>
        <Link
          href="/me/inbox"
          className="grid h-12 w-12 place-items-center rounded-[1rem] bg-surface text-label shadow-[var(--shadow-card)] ring-1 ring-border"
          aria-label="Einstellungen und Mitteilungen"
        >
          <Settings className="h-6 w-6" strokeWidth={2.1} />
        </Link>
      </motion.section>

      <motion.section
        className="card-elevated grid grid-cols-[5.5rem_1fr] items-center gap-3 p-4"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        <span className="grid h-20 w-20 place-items-center rounded-full bg-accent-soft ring-1 ring-border">
          <span className="font-display text-[2.5rem] font-semibold text-accent">W</span>
        </span>
        <div className="grid grid-cols-4 overflow-hidden">
          <Stat value={summary?.productCount ?? 0} label="Produkte" divider />
          <Stat value={summary?.experienceCount ?? 0} label="Erfahrungen" divider />
          <Stat value={summary?.answerCount ?? 0} label="Antworten" divider />
          <Stat value={summary?.helpfulReceived ?? 0} label="Käufern geholfen" />
        </div>
      </motion.section>

      <motion.section
        className="card-elevated flex items-center gap-5 p-5"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        <RebuyRing value={rebuyRate} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-accent">
            Dein Rebuy-Profil
          </h2>
          <p className="mt-3 text-[1.3125rem] leading-snug text-label">
            deiner Produkte würdest du wieder kaufen.
          </p>
          <span className="mt-4 inline-flex rounded-full bg-surface px-3 py-1.5 text-[0.9375rem] font-medium text-accent shadow-[var(--shadow-xs)] ring-1 ring-border">
            Überdurchschnittlich
          </span>
        </div>
      </motion.section>

      <motion.section
        className="card overflow-hidden"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
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

      <motion.section
        className="card flex items-center gap-4 p-4"
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      >
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-border">
          <Users className="h-7 w-7" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.35rem] font-bold text-accent">Mein Einfluss</h2>
          <p className="mt-0.5 text-[1.0625rem] leading-snug text-muted-foreground">
            Deine Antworten helfen anderen, bessere Käufe zu machen.
          </p>
        </div>
        <ChevronRight className="h-6 w-6 text-label-3" strokeWidth={2.3} />
      </motion.section>
    </motion.div>
  );
}
