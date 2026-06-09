'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ChevronRight,
  MessageCircle,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { CategoryDto, ProductSummaryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { SegmentedControl } from '@/components/ios/SegmentedControl';
import { Thumb } from '@/components/Thumb';
import { Skeleton, EmptyState } from '@/components/states/States';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'rebuy' | 'regret' | 'discussed' | 'longterm';

const SEGMENTS = [
  { value: 'rebuy' as const, label: 'Wieder kaufen' },
  { value: 'regret' as const, label: 'Bereuen' },
  { value: 'discussed' as const, label: 'Diskutiert' },
  { value: 'longterm' as const, label: 'Langzeit' },
];

const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function signalStrength(product: ProductSummaryDto) {
  if (product.experienceCount < 20) return 'Frühes Signal';
  if (product.experienceCount < 80) return 'Erste Tendenz';
  if (product.experienceCount < 250) return 'Belastbare Tendenz';
  return 'Starkes Langzeitsignal';
}

function rebuyLine(product: ProductSummaryDto) {
  const score = product.rebuyScore;
  if (score === null) return 'Noch zu wenige Daten';
  const yes = Math.round((score / 100) * product.ownerCount);
  if (product.experienceCount < 20) {
    return `${yes} von ${product.ownerCount} würden es wieder kaufen`;
  }
  return `${score}% würden es nach 6 Monaten wieder kaufen`;
}

function regretLine(product: ProductSummaryDto) {
  const regret = product.regretScore;
  const no = regret === null ? 0 : Math.round((regret / 100) * product.ownerCount);
  if (regret === null) return 'Noch kein klares Bereuen-Signal';
  return `${no} von ${product.ownerCount} würden es nicht wieder kaufen`;
}

/* ── Hero: Langzeit-Helden (#1 rebuy) ───────────────────────────────────── */
function HeroCard({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  return (
    <Link
      href={`/products/${product.id}`}
      className="press block rounded-[1.5rem] p-4 ring-1 ring-positive/12"
      style={{ background: 'linear-gradient(160deg,#f1f7f3,#e9f4ec)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-positive-soft text-positive-ink">
            <Trophy className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
          </span>
          <h2 className="text-[1.15rem] font-bold tracking-tight text-label">Langzeit-Helden</h2>
        </div>
        <ChevronRight className="h-5 w-5 text-label-3" strokeWidth={2.4} />
      </div>

      <div className="mt-4 grid grid-cols-[6.5rem_1fr] items-center gap-4">
        <Thumb product={product} className="h-[6.5rem] w-[6.5rem]" rounded="rounded-[1.1rem]" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-[0.6rem] bg-positive-soft px-2 py-0.5 text-[0.875rem] font-bold text-positive-ink">
              #{entry.rank}
            </span>
            <h3 className="truncate text-[1.15rem] font-bold leading-tight text-label">
              {product.canonicalName}
            </h3>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[0.9375rem] font-medium leading-snug text-positive-ink">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-positive text-white">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {rebuyLine(product)}
          </p>
          <p className="mt-3 text-[0.875rem] text-muted-foreground">
            {product.experienceCount} {plural(product.experienceCount, 'Erfahrung', 'Erfahrungen')}{' '}
            · {signalStrength(product)}
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ── Regret-Radar (#1 regret) ───────────────────────────────────────────── */
function RegretCard({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  const reasons = [
    ...(product.category ? [product.category.name] : []),
    'Akkulaufzeit',
    'Lautstärke',
  ].slice(0, 2);
  return (
    <Link
      href={`/products/${product.id}`}
      className="press block rounded-[1.5rem] p-4 ring-1 ring-regret/12"
      style={{ background: 'linear-gradient(160deg,#fcf2f0,#fbeae7)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-regret-soft text-regret-ink">
            <AlertTriangle className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
          </span>
          <h2 className="text-[1.15rem] font-bold tracking-tight text-label">Regret-Radar</h2>
        </div>
        <ChevronRight className="h-5 w-5 text-label-3" strokeWidth={2.4} />
      </div>

      <div className="mt-4 grid grid-cols-[6.5rem_1fr] items-center gap-4">
        <Thumb product={product} className="h-[6.5rem] w-[6.5rem]" rounded="rounded-[1.1rem]" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-[0.6rem] bg-regret-soft px-2 py-0.5 text-[0.875rem] font-bold text-regret-ink">
              #{entry.rank}
            </span>
            <h3 className="truncate text-[1.15rem] font-bold leading-tight text-label">
              {product.canonicalName}
            </h3>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[0.9375rem] font-medium leading-snug text-regret-ink">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
            {regretLine(product)}
          </p>
          {reasons.length > 0 && (
            <p className="mt-3 text-[0.875rem] text-muted-foreground">
              Gründe: {reasons.join(', ')}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Most-discussed grid tile ───────────────────────────────────────────── */
function DiscussedTile({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  return (
    <Link href={`/products/${product.id}`} className="card press flex flex-col gap-2.5 p-3.5">
      <Thumb product={product} className="h-[5.5rem] w-full" rounded="rounded-[0.95rem]" />
      <div className="min-w-0">
        <h3 className="text-balance text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.875rem] font-medium text-positive-ink">
          <span className="h-2 w-2 rounded-full bg-positive" />
          Sehr beliebt
        </p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          {entry.metricValue} {plural(entry.metricValue, 'Frage', 'Fragen')}
        </p>
      </div>
    </Link>
  );
}

/* ── "Überraschend gut" — a high-rebuy product lower in attention ────────── */
function SurpriseCard({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  return (
    <Link href={`/products/${product.id}`} className="card press flex items-center gap-2 px-1 py-1">
      <div className="flex flex-1 items-center gap-3 p-2.5">
        <Thumb product={product} className="h-[4.75rem] w-[4.75rem]" rounded="rounded-[1rem]" />
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-positive-soft text-positive-ink">
              <Sparkles className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <p className="text-[1.0625rem] font-bold tracking-tight text-label">Überraschend gut</p>
          </div>
          <h3 className="truncate text-[1.0625rem] font-semibold leading-tight text-label">
            {product.canonicalName}
          </h3>
          <p className="mt-1 text-[0.9375rem] leading-snug text-positive-ink">
            Mehr als erwartet — {product.experienceCount}{' '}
            {plural(product.experienceCount, 'Erfahrung', 'Erfahrungen')}.
          </p>
        </div>
      </div>
      <ChevronRight className="mr-2 h-5 w-5 shrink-0 text-label-3" strokeWidth={2.4} />
    </Link>
  );
}

/* ── Generic ranked row (used for the per-tab list views) ───────────────── */
function RankedRow({ entry, tab }: { entry: RankingEntryDto; tab: Tab }) {
  const product = entry.product;
  const negative = tab === 'regret';
  const line =
    tab === 'regret'
      ? regretLine(product)
      : tab === 'discussed'
        ? `${entry.metricValue} ${plural(entry.metricValue, 'Frage', 'Fragen')}`
        : rebuyLine(product);
  return (
    <Link href={`/products/${product.id}`} className="card press flex items-center gap-3 p-3">
      <span
        className={cn(
          'tnum grid h-8 w-8 shrink-0 place-items-center rounded-[0.65rem] text-[0.9375rem] font-bold',
          negative ? 'bg-regret-soft text-regret-ink' : 'bg-positive-soft text-positive-ink',
        )}
      >
        {entry.rank}
      </span>
      <Thumb product={product} className="h-[3.75rem] w-[3.75rem]" rounded="rounded-[0.85rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p
          className={cn(
            'mt-1 truncate text-[0.9375rem] leading-snug',
            negative ? 'text-regret-ink' : 'text-muted-foreground',
          )}
        >
          {line}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-label-3" strokeWidth={2.4} />
    </Link>
  );
}

export function RankingsClient({
  categories,
  rebuy,
  regret,
  discussed,
}: {
  categories: CategoryDto[];
  rebuy: RankingEntryDto[];
  regret: RankingEntryDto[];
  discussed: RankingEntryDto[];
}) {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get('cat') ?? '';
  const [tab, setTab] = useState<Tab>('rebuy');
  const [category, setCategory] = useState<string>(
    categories.some((c) => c.slug === initialCat) ? initialCat : '',
  );
  const [catEntries, setCatEntries] = useState<RankingEntryDto[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  const loadCategory = useCallback(async (slug: string) => {
    setCatLoading(true);
    try {
      const data = await api.rankings.byCategory(slug, 30, { cache: 'no-store' });
      setCatEntries(data);
    } catch {
      setCatEntries([]);
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (category) void loadCategory(category);
    else setCatEntries(null);
  }, [category, loadCategory]);

  // The "surprise" pick: a strong rebuy product that isn't the #1 hero.
  const surprise = useMemo(
    () => rebuy.find((e) => e.rank >= 3 && (e.product.rebuyScore ?? 0) >= 75) ?? rebuy[2] ?? null,
    [rebuy],
  );

  const hero = rebuy[0] ?? null;
  const topRegret = regret[0] ?? null;

  const isOverview = tab === 'rebuy' && !category;

  return (
    <motion.div
      className="space-y-5 pt-1"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.section variants={rise}>
        <p className="text-[1.4rem] font-bold leading-none tracking-tight text-label">Entdecken</p>
        <h1 className="font-display mt-3 text-balance text-[2.85rem] font-semibold leading-[0.98] text-label">
          Was lohnt sich wirklich?
        </h1>
      </motion.section>

      <motion.div variants={rise}>
        <SegmentedControl
          segments={SEGMENTS}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setCategory('');
          }}
          className="rounded-full p-1 [&>button]:py-2.5 [&>div]:rounded-full"
        />
      </motion.div>

      {categories.length > 0 && (
        <motion.div
          className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
          variants={rise}
        >
          <Chip active={!category} onClick={() => setCategory('')}>
            Alle
          </Chip>
          {categories.slice(0, 10).map((c) => (
            <Chip key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </motion.div>
      )}

      {/* ── Category filter view ── */}
      {category ? (
        catLoading ? (
          <ListSkeleton />
        ) : catEntries && catEntries.length > 0 ? (
          <motion.div variants={rise} className="space-y-2.5">
            {catEntries.slice(0, 20).map((entry) => (
              <RankedRow key={entry.product.id} entry={entry} tab="rebuy" />
            ))}
          </motion.div>
        ) : (
          <NoSignal />
        )
      ) : isOverview ? (
        /* ── Curated overview (default "Wieder kaufen") ── */
        <>
          {hero && (
            <motion.section variants={rise}>
              <HeroCard entry={hero} />
            </motion.section>
          )}
          {topRegret && (
            <motion.section variants={rise}>
              <RegretCard entry={topRegret} />
            </motion.section>
          )}
          {discussed.length > 0 && (
            <motion.section variants={rise} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <MessageCircle
                    className="h-[1.15rem] w-[1.15rem] text-positive-ink"
                    strokeWidth={2.2}
                  />
                  <h2 className="text-[1.15rem] font-bold tracking-tight text-label">
                    Am meisten gefragt
                  </h2>
                </div>
                <button
                  onClick={() => setTab('discussed')}
                  className="tap-dim flex items-center text-[0.9375rem] text-muted-foreground"
                  type="button"
                >
                  Alle anzeigen
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {discussed.slice(0, 2).map((entry) => (
                  <DiscussedTile key={entry.product.id} entry={entry} />
                ))}
              </div>
            </motion.section>
          )}
          {surprise && (
            <motion.section variants={rise}>
              <SurpriseCard entry={surprise} />
            </motion.section>
          )}
          {!hero && !topRegret && <NoSignal />}
        </>
      ) : (
        /* ── Per-tab ranked list (Bereuen / Diskutiert / Langzeit) ── */
        <motion.div variants={rise} className="space-y-2.5">
          {(() => {
            const source =
              tab === 'regret'
                ? regret
                : tab === 'discussed'
                  ? discussed
                  : [...rebuy].sort(
                      (a, b) => b.product.experienceCount - a.product.experienceCount,
                    );
            if (source.length === 0) return <NoSignal />;
            return source
              .slice(0, 20)
              .map((entry, i) => (
                <RankedRow key={entry.product.id} entry={{ ...entry, rank: i + 1 }} tab={tab} />
              ));
          })()}
        </motion.div>
      )}
    </motion.div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'tap-dim shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium',
        active
          ? 'bg-accent text-white'
          : 'bg-surface text-muted-foreground shadow-[var(--shadow-xs)] ring-1 ring-border',
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card p-3">
          <Skeleton className="h-14" />
        </div>
      ))}
    </div>
  );
}

function NoSignal() {
  return (
    <EmptyState
      icon={<Sparkles className="h-7 w-7" strokeWidth={1.8} />}
      title="Noch keine Tendenz"
      description="Sobald genug echte Erfahrungen vorliegen, erscheinen hier Signale."
    />
  );
}
