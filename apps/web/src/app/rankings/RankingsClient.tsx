'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { CategoryDto, ProductSummaryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { Stamp } from '@/components/receipt/Stamp';
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
  if (product.experienceCount < 20) return 'Signal im Aufbau';
  if (product.experienceCount < 80) return 'Erste Tendenz';
  if (product.experienceCount < 250) return 'Belastbare Tendenz';
  return 'Starkes Langzeitsignal';
}

function rebuyLine(product: ProductSummaryDto) {
  const score = product.rebuyScore;
  if (score === null) return 'Noch zu wenige Daten';
  const yes = Math.round((score / 100) * product.ownerCount);
  if (product.experienceCount < 20) {
    return `Im Aufbau: ${yes} von ${product.ownerCount} sagen ja`;
  }
  return `${score}% würden es nach 6 Monaten wieder kaufen`;
}

function regretLine(product: ProductSummaryDto) {
  const regret = product.regretScore;
  const no = regret === null ? 0 : Math.round((regret / 100) * product.ownerCount);
  if (regret === null) return 'Noch kein klares Bereuen-Signal';
  return `${no} von ${product.ownerCount} würden es nicht wieder kaufen`;
}

/* ── Mono ink tabs (same language as the product page) ─────────────────── */
function InkTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div role="tablist" className="hairline flex gap-5 overflow-x-auto no-scrollbar">
      {SEGMENTS.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={active}
            onClick={() => {
              navigator.vibrate?.(5);
              onChange(seg.value);
            }}
            className={cn(
              'relative shrink-0 whitespace-nowrap pb-2.5 pt-1 transition-colors duration-200',
              active ? 'text-label' : 'text-muted-foreground active:opacity-60',
            )}
          >
            <span className="mono-data text-[0.75rem] font-semibold uppercase tracking-[0.14em]">
              {seg.label}
            </span>
            {active && (
              <motion.span
                layoutId="rankings-tab-ink"
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 480, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Hero: Langzeit-Held (#1 rebuy) ─────────────────────────────────────── */
function HeroCard({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  return (
    <Link
      href={`/products/${product.id}`}
      className="press panel-positive relative block overflow-hidden rounded-[var(--radius-lg)] p-4 shadow-[0_0_0_1px_var(--color-border)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-positive-ink">
          Langzeit-Held
        </p>
        <Stamp tone="positive" animate={false} className="!text-[0.625rem]">
          Wieder kaufen
        </Stamp>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Thumb product={product} className="h-24 w-24" rounded="rounded-[0.9rem]" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.5rem] leading-[1.05] text-label">
            {product.canonicalName}
          </h3>
          <p className="mt-1.5 text-[0.9375rem] font-medium leading-snug text-positive-ink">
            {rebuyLine(product)}
          </p>
          <p className="mono-data mt-2 text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
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
  return (
    <Link
      href={`/products/${product.id}`}
      className="press panel-regret relative block overflow-hidden rounded-[var(--radius-lg)] p-4 shadow-[0_0_0_1px_var(--color-border)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-regret-ink">
          Regret-Radar
        </p>
        <Stamp tone="regret" animate={false} className="!text-[0.625rem]">
          Lieber nicht
        </Stamp>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Thumb product={product} className="h-24 w-24" rounded="rounded-[0.9rem]" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.5rem] leading-[1.05] text-label">
            {product.canonicalName}
          </h3>
          <p className="mt-1.5 text-[0.9375rem] font-medium leading-snug text-regret-ink">
            {regretLine(product)}
          </p>
          <p className="mono-data mt-2 text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
            {product.experienceCount} {plural(product.experienceCount, 'Erfahrung', 'Erfahrungen')}
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ── "Überraschend gut" — a high-rebuy product lower in attention ────────── */
function SurpriseCard({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  return (
    <Link href={`/products/${product.id}`} className="card press flex items-center gap-3.5 p-3.5">
      <Thumb product={product} className="h-[4.5rem] w-[4.5rem]" rounded="rounded-[0.9rem]" />
      <div className="min-w-0 flex-1">
        <p className="mono-data flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          Überraschend gut
        </p>
        <h3 className="mt-1 truncate text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className="mt-0.5 truncate text-[0.875rem] text-muted-foreground">
          Mehr als erwartet — {product.experienceCount}{' '}
          {plural(product.experienceCount, 'Erfahrung', 'Erfahrungen')}.
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-label-3" strokeWidth={2.4} />
    </Link>
  );
}

/* ── Ledger row: rank · name ········ score (a receipt line) ────────────── */
function RankedRow({ entry, tab }: { entry: RankingEntryDto; tab: Tab }) {
  const product = entry.product;
  const negative = tab === 'regret';
  const score =
    tab === 'discussed'
      ? `${entry.metricValue}`
        : negative
        ? product.regretScore === null
          ? '–'
          : `${product.regretScore}%`
        : product.rebuyScore === null || product.experienceCount < 20
          ? '–'
          : `${product.rebuyScore}%`;
  const sub =
    tab === 'regret'
      ? regretLine(product)
      : tab === 'discussed'
        ? `${entry.metricValue} ${plural(entry.metricValue, 'Frage', 'Fragen')}`
        : rebuyLine(product);

  return (
    <Link href={`/products/${product.id}`} className="tap hairline flex items-center gap-3 px-1 py-3">
      <span className="mono-data w-7 shrink-0 text-right text-[0.875rem] font-semibold text-faint">
        {String(entry.rank).padStart(2, '0')}
      </span>
      <Thumb product={product} className="h-[3.4rem] w-[3.4rem]" rounded="rounded-[0.7rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p
          className={cn(
            'mt-0.5 truncate text-[0.8125rem] leading-snug',
            negative ? 'text-regret-ink' : 'text-muted-foreground',
          )}
        >
          {sub}
        </p>
      </div>
      <span
        className={cn(
          'font-display shrink-0 text-[1.6rem] leading-none',
          negative ? 'text-regret-ink' : 'text-accent-ink',
        )}
      >
        {score}
      </span>
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
      const data = await api.rankings.byCategory(slug, 30, { cache: 'no-store' }, 20);
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
      className="mx-auto max-w-2xl space-y-5 pt-4"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.section variants={rise}>
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Entdecken
        </p>
        <h1 className="font-display mt-2.5 text-balance text-[3rem] leading-[1.0] text-label">
          Was lohnt sich <em className="text-accent-ink">wirklich</em>?
        </h1>
      </motion.section>

      <motion.div variants={rise}>
        <InkTabs
          value={tab}
          onChange={(v) => {
            setTab(v);
            setCategory('');
          }}
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

      {/* ── Content area — cross-faded + staggered on every tab/filter switch ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={category ? `cat-${category}-${catLoading ? 'loading' : 'ready'}` : `tab-${tab}`}
          className="space-y-5"
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
          }}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } }}
        >
          {category ? (
            catLoading ? (
              <ListSkeleton />
            ) : catEntries && catEntries.length > 0 ? (
              <StaggeredRows entries={catEntries.slice(0, 20)} tab="rebuy" renumber={false} />
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
              {surprise && (
                <motion.section variants={rise}>
                  <SurpriseCard entry={surprise} />
                </motion.section>
              )}
              {discussed.length > 0 && (
                <motion.section variants={rise} className="space-y-1">
                  <div className="flex items-baseline justify-between px-1 pb-2">
                    <h2 className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Am meisten gefragt
                    </h2>
                    <button
                      onClick={() => setTab('discussed')}
                      className="tap-dim mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent"
                      type="button"
                    >
                      Alle
                    </button>
                  </div>
                  <div className="card px-3">
                    {discussed.slice(0, 3).map((entry, i) => (
                      <RankedRow
                        key={entry.product.id}
                        entry={{ ...entry, rank: i + 1 }}
                        tab="discussed"
                      />
                    ))}
                  </div>
                </motion.section>
              )}
              {!hero && !topRegret && <NoSignal />}
            </>
          ) : (
            /* ── Per-tab ranked list (Bereuen / Diskutiert / Langzeit) ── */
            (() => {
              const source =
                tab === 'regret'
                  ? regret
                  : tab === 'discussed'
                    ? discussed
                    : [...rebuy].sort(
                        (a, b) => b.product.experienceCount - a.product.experienceCount,
                      );
              if (source.length === 0) return <NoSignal />;
              return <StaggeredRows entries={source.slice(0, 20)} tab={tab} renumber />;
            })()
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/** Ranked ledger inside one card — rows cascade in with a short stagger. */
function StaggeredRows({
  entries,
  tab,
  renumber,
}: {
  entries: RankingEntryDto[];
  tab: Tab;
  renumber: boolean;
}) {
  return (
    <motion.div
      className="card px-3 [&>a:last-child]:after:hidden"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
    >
      {entries.map((entry, i) => (
        <motion.div
          key={entry.product.id}
          variants={rise}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <RankedRow entry={renumber ? { ...entry, rank: i + 1 } : entry} tab={tab} />
        </motion.div>
      ))}
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
        'tap-dim mono-data shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em]',
        active
          ? 'bg-label text-canvas'
          : 'bg-surface text-muted-foreground shadow-[0_0_0_1px_var(--color-border)]',
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="card space-y-3 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14" />
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
