'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  CircleAlert,
  Compass,
  MessageCircle,
  PackageSearch,
  Search,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import type { CategoryDto, ProductSummaryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { Thumb } from '@/components/Thumb';
import { Skeleton, EmptyState } from '@/components/states/States';
import { plural } from '@/lib/format';
import { dataConfidenceLabel, isEarlySignal } from '@/lib/verdict';
import { NetConsensusBadge } from '@/components/NetConsensusBadge';
import { cn } from '@/lib/utils';
import { productPath } from '@/lib/seo';

type Tab = 'overview' | 'owners' | 'risk' | 'discussed' | 'new';
type RowMode = Tab | 'category';

const SEGMENTS = [
  { value: 'overview' as const, label: 'Start' },
  { value: 'owners' as const, label: 'Stimmen' },
  { value: 'risk' as const, label: 'Risiken' },
  { value: 'discussed' as const, label: 'Gefragt' },
  { value: 'new' as const, label: 'Neu' },
];

const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function sourceLabel(count: number) {
  return `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`;
}

function rebuyLine(product: ProductSummaryDto) {
  const score = product.rebuyScore;
  if (score === null) {
    if (product.externalAvgPercent !== null && product.externalSourceCount > 0) {
      return `Netz-Konsens ${product.externalAvgPercent}% aus ${sourceLabel(product.externalSourceCount)}`;
    }
    return 'Noch keine Besitzerstimme';
  }

  const yes = Math.round((score / 100) * product.ownerCount);
  if (isEarlySignal(product.experienceCount)) {
    return `${yes} von ${product.ownerCount} würden wieder kaufen · frühes Signal`;
  }
  return `${score}% würden es nach echter Nutzung wieder kaufen`;
}

function regretLine(product: ProductSummaryDto) {
  const regret = product.regretScore;
  if (regret === null || regret <= 0) return 'Noch kein klares Bereuen-Signal';
  const no = Math.round((regret / 100) * product.ownerCount);
  return `${no} von ${product.ownerCount} würden es nicht wieder kaufen`;
}

function productMeta(product: ProductSummaryDto) {
  return [product.brand, product.category?.name].filter(Boolean).join(' · ') || 'Produkt';
}

function entriesFromProducts(products: ProductSummaryDto[]): RankingEntryDto[] {
  return products.map((product, index) => ({
    rank: index + 1,
    product,
    metricValue: product.externalAvgPercent ?? product.rebuyScore ?? product.experienceCount,
  }));
}

function InkTabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
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
            type="button"
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

function SignalSummary({
  newest,
  ownerSignals,
  categories,
}: {
  newest: ProductSummaryDto[];
  ownerSignals: RankingEntryDto[];
  categories: CategoryDto[];
}) {
  const externalCount = newest.filter((p) => p.externalSourceCount > 0).length;
  const ownerCount = ownerSignals.reduce((sum, entry) => sum + entry.product.experienceCount, 0);

  return (
    <motion.section variants={rise} className="card-elevated overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-[var(--color-separator)]">
        <SummaryMetric
          label="Recherchiert"
          value={String(newest.length)}
          sub={`${externalCount} mit Netz`}
        />
        <SummaryMetric label="Stimmen" value={String(ownerCount)} sub="Wudly" />
        <SummaryMetric label="Kategorien" value={String(categories.length)} sub="Regale" />
      </div>
      <div className="hairline flex items-center gap-3 px-4 py-3.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
          <Compass className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] font-semibold leading-tight text-label">Heute interessant</p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
            Besitzerstimmen, Netz-Konsens und neue Katalogprodukte in einer Ansicht.
          </p>
        </div>
        <Link
          href="/check"
          className="tap-dim inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-3.5 text-[0.875rem] font-semibold text-primary-foreground"
        >
          <Search className="h-4 w-4" strokeWidth={2.4} />
          Prüfen
        </Link>
      </div>
    </motion.section>
  );
}

function SummaryMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-2 py-3.5 text-center">
      <div className="font-display text-[1.8rem] leading-none text-label tnum">{value}</div>
      <div className="mt-1 mono-data text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[0.75rem] text-faint">{sub}</div>
    </div>
  );
}

function HeroCard({ entry }: { entry: RankingEntryDto }) {
  const product = entry.product;
  const early = isEarlySignal(product.experienceCount);

  return (
    <Link
      href={productPath(product)}
      className="press panel-positive relative block overflow-hidden rounded-[var(--radius-lg)] p-4 shadow-[0_0_0_1px_var(--color-border)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-positive-ink">
          {early ? 'Erste Besitzerstimme' : 'Wieder kaufen'}
        </p>
        <span className="rounded-full bg-positive-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-positive-ink">
          {dataConfidenceLabel(product.experienceCount)}
        </span>
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
            {product.experienceCount} {plural(product.experienceCount, 'Erfahrung', 'Erfahrungen')}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={rise} className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fill-2 text-label-2">
            {icon}
          </span>
          <h2 className="mono-data truncate text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function ProductShelf({
  entries,
  mode,
  limit = 5,
}: {
  entries: RankingEntryDto[];
  mode: RowMode;
  limit?: number;
}) {
  return <StaggeredRows entries={entries.slice(0, limit)} mode={mode} renumber />;
}

function RankedRow({ entry, mode }: { entry: RankingEntryDto; mode: RowMode }) {
  const product = entry.product;
  const metric = metricFor(entry, mode);
  const sub = rowSubline(entry, mode);

  return (
    <Link
      href={productPath(product)}
      className="tap hairline flex items-center gap-3 px-1 py-3"
    >
      <span className="mono-data w-7 shrink-0 text-right text-[0.875rem] font-semibold text-faint">
        {String(entry.rank).padStart(2, '0')}
      </span>
      <Thumb product={product} className="h-[3.4rem] w-[3.4rem]" rounded="rounded-[0.7rem]" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[1.0625rem] font-semibold leading-tight text-label">
          {product.canonicalName}
        </h3>
        <p className={cn('mt-0.5 truncate text-[0.8125rem] leading-snug', metric.subClass)}>
          {sub}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[0.75rem] text-faint">
          <span className="truncate">{productMeta(product)}</span>
          <NetConsensusBadge
            avgPercent={product.externalAvgPercent}
            sourceCount={product.externalSourceCount}
          />
        </div>
      </div>
      <div className="flex w-[3.55rem] shrink-0 flex-col items-end gap-0.5 text-right">
        <span className={cn('font-display text-[1.45rem] leading-none tnum', metric.className)}>
          {metric.value}
        </span>
        <span className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">
          {metric.label}
        </span>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-label-3" strokeWidth={2.4} />
    </Link>
  );
}

function metricFor(entry: RankingEntryDto, mode: RowMode) {
  const product = entry.product;

  if (mode === 'discussed') {
    return {
      value: String(entry.metricValue),
      label: entry.metricValue === 1 ? 'Frage' : 'Fragen',
      className: 'text-accent-ink',
      subClass: 'text-muted-foreground',
    };
  }

  if (mode === 'risk') {
    const regret = product.regretScore ?? 0;
    return {
      value: regret > 0 ? `${regret}%` : 'Offen',
      label: 'Risiko',
      className: regret >= 40 ? 'text-regret-ink' : 'text-muted-foreground',
      subClass: regret > 0 ? 'text-regret-ink' : 'text-muted-foreground',
    };
  }

  if (product.rebuyScore !== null) {
    return {
      value: `${product.rebuyScore}%`,
      label: isEarlySignal(product.experienceCount) ? 'früh' : 'Wudly',
      className: product.rebuyScore >= 75 ? 'text-accent-ink' : 'text-unsure-ink',
      subClass: 'text-positive-ink',
    };
  }

  if (product.externalAvgPercent !== null && product.externalSourceCount > 0) {
    return {
      value: `${product.externalAvgPercent}%`,
      label: 'Netz',
      className: 'text-label-2',
      subClass: 'text-muted-foreground',
    };
  }

  return {
    value: 'Neu',
    label: 'Katalog',
    className: 'text-muted-foreground',
    subClass: 'text-muted-foreground',
  };
}

function rowSubline(entry: RankingEntryDto, mode: RowMode) {
  const product = entry.product;

  if (mode === 'risk') return regretLine(product);
  if (mode === 'discussed')
    return `${entry.metricValue} ${plural(entry.metricValue, 'offene Frage', 'offene Fragen')}`;
  if (product.rebuyScore !== null) return rebuyLine(product);
  if (product.externalAvgPercent !== null && product.externalSourceCount > 0) {
    return `Netz-Konsens aus ${sourceLabel(product.externalSourceCount)}`;
  }
  return 'Frisch im Katalog · noch ohne Signal';
}

function Overview({
  categories,
  rebuy,
  regret,
  discussed,
  newest,
  onTab,
}: {
  categories: CategoryDto[];
  rebuy: RankingEntryDto[];
  regret: RankingEntryDto[];
  discussed: RankingEntryDto[];
  newest: ProductSummaryDto[];
  onTab: (tab: Tab) => void;
}) {
  const newestEntries = useMemo(() => entriesFromProducts(newest), [newest]);

  const hero = rebuy[0] ?? null;

  return (
    <>
      <SignalSummary newest={newest} ownerSignals={rebuy} categories={categories} />

      {hero && (
        <motion.section variants={rise}>
          <HeroCard entry={hero} />
        </motion.section>
      )}

      {newestEntries.length > 0 && (
        <Section
          icon={<PackageSearch className="h-4 w-4" strokeWidth={2.2} />}
          title="Frisch im Katalog"
          action={<TabAction label="Alle" onClick={() => onTab('new')} />}
        >
          <ProductShelf entries={newestEntries} mode="new" />
        </Section>
      )}

      {rebuy.length > 0 && (
        <Section
          icon={<ThumbsUp className="h-4 w-4" strokeWidth={2.2} />}
          title="Erste Besitzerstimmen"
          action={<TabAction label="Alle" onClick={() => onTab('owners')} />}
        >
          <ProductShelf entries={rebuy} mode="owners" limit={4} />
        </Section>
      )}

      {regret.length > 0 && (
        <Section
          icon={<CircleAlert className="h-4 w-4" strokeWidth={2.2} />}
          title="Warnsignale"
          action={<TabAction label="Alle" onClick={() => onTab('risk')} />}
        >
          <ProductShelf entries={regret} mode="risk" limit={4} />
        </Section>
      )}

      {discussed.length > 0 && (
        <Section
          icon={<MessageCircle className="h-4 w-4" strokeWidth={2.2} />}
          title="Gefragt"
          action={<TabAction label="Alle" onClick={() => onTab('discussed')} />}
        >
          <ProductShelf entries={discussed} mode="discussed" limit={4} />
        </Section>
      )}

      {!hero && newestEntries.length === 0 && discussed.length === 0 && <HelpfulEmpty />}
    </>
  );
}

function TabAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap-dim mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent"
      type="button"
    >
      {label}
    </button>
  );
}

export function RankingsClient({
  categories,
  rebuy,
  regret,
  discussed,
  newest,
}: {
  categories: CategoryDto[];
  rebuy: RankingEntryDto[];
  regret: RankingEntryDto[];
  discussed: RankingEntryDto[];
  newest: ProductSummaryDto[];
}) {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get('cat') ?? '';
  const [tab, setTab] = useState<Tab>('overview');
  const [category, setCategory] = useState<string>(
    categories.some((c) => c.slug === initialCat) ? initialCat : '',
  );
  const [catEntries, setCatEntries] = useState<RankingEntryDto[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  const selectedCategory = categories.find((c) => c.slug === category) ?? null;

  const fallbackCategoryEntries = useCallback(
    (slug: string) => entriesFromProducts(newest.filter((p) => p.category?.slug === slug)),
    [newest],
  );

  const loadCategory = useCallback(
    async (slug: string) => {
      setCatLoading(true);
      try {
        const data = await api.rankings.byCategory(slug, 30, { cache: 'no-store' }, 0);
        const fallback = fallbackCategoryEntries(slug);
        setCatEntries(data.length > 0 ? data : fallback);
      } catch {
        setCatEntries(fallbackCategoryEntries(slug));
      } finally {
        setCatLoading(false);
      }
    },
    [fallbackCategoryEntries],
  );

  useEffect(() => {
    if (category) void loadCategory(category);
    else setCatEntries(null);
  }, [category, loadCategory]);

  const newestEntries = useMemo(() => entriesFromProducts(newest), [newest]);
  const riskEntries = useMemo(
    () => regret.filter((entry) => (entry.product.regretScore ?? 0) > 0),
    [regret],
  );

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
        <p className="mt-3 max-w-xl text-[1rem] leading-snug text-muted-foreground">
          Produkte, bei denen schon etwas Belastbares vorliegt: echte Stimmen, Netz-Konsens oder ein
          sauber recherchierter Katalogeintrag.
        </p>
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
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={category === c.slug}
              onClick={() => {
                setCategory(c.slug);
                setTab('overview');
              }}
            >
              {c.name}
            </Chip>
          ))}
        </motion.div>
      )}

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
            <CategoryView
              category={selectedCategory}
              loading={catLoading}
              entries={catEntries ?? []}
            />
          ) : tab === 'overview' ? (
            <Overview
              categories={categories}
              rebuy={rebuy}
              regret={riskEntries}
              discussed={discussed}
              newest={newest}
              onTab={setTab}
            />
          ) : tab === 'owners' ? (
            rebuy.length > 0 ? (
              <ProductShelf entries={rebuy} mode="owners" limit={20} />
            ) : (
              <HelpfulEmpty />
            )
          ) : tab === 'risk' ? (
            riskEntries.length > 0 ? (
              <ProductShelf entries={riskEntries} mode="risk" limit={20} />
            ) : (
              <NoRisk />
            )
          ) : tab === 'discussed' ? (
            discussed.length > 0 ? (
              <ProductShelf entries={discussed} mode="discussed" limit={20} />
            ) : (
              <HelpfulEmpty />
            )
          ) : newestEntries.length > 0 ? (
            <ProductShelf entries={newestEntries} mode="new" limit={20} />
          ) : (
            <HelpfulEmpty />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function CategoryView({
  category,
  loading,
  entries,
}: {
  category: CategoryDto | null;
  loading: boolean;
  entries: RankingEntryDto[];
}) {
  if (loading) return <ListSkeleton />;

  return (
    <>
      <motion.section variants={rise} className="card-elevated overflow-hidden p-4">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Kategoriefokus
        </p>
        <h2 className="font-display mt-2 text-[2rem] leading-none text-label">
          {category?.name ?? 'Kategorie'}
        </h2>
        <p className="mt-2 text-[0.95rem] leading-snug text-muted-foreground">
          Sortiert nach Wudly-Stimmen, Netz-Konsens und Aktualität.
        </p>
      </motion.section>

      {entries.length > 0 ? (
        <StaggeredRows entries={entries} mode="category" renumber={false} />
      ) : (
        <EmptyState
          icon={<PackageSearch className="h-7 w-7" strokeWidth={1.8} />}
          title="Noch nichts im Katalog"
          description="Sobald ein Produkt aus dieser Kategorie recherchiert ist, erscheint es hier."
          action={
            <PrimaryLink href="/check" icon={<Search className="h-4 w-4" />}>
              Produkt prüfen
            </PrimaryLink>
          }
        />
      )}
    </>
  );
}

function StaggeredRows({
  entries,
  mode,
  renumber,
}: {
  entries: RankingEntryDto[];
  mode: RowMode;
  renumber: boolean;
}) {
  return (
    <motion.div
      className="card px-3 [&>div:last-child>a]:after:hidden"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
    >
      {entries.map((entry, i) => (
        <motion.div
          key={entry.product.id}
          variants={rise}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <RankedRow entry={renumber ? { ...entry, rank: i + 1 } : entry} mode={mode} />
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
      aria-pressed={active}
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

function HelpfulEmpty() {
  return (
    <EmptyState
      icon={<Sparkles className="h-7 w-7" strokeWidth={1.8} />}
      title="Noch kein Signal"
      description="Der Katalog wächst gerade. Starte mit einem konkreten Produkt oder einer Kategorie."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <PrimaryLink href="/check" icon={<Search className="h-4 w-4" />}>
            Produkt prüfen
          </PrimaryLink>
          <SecondaryLink href="/compare">Vergleichen</SecondaryLink>
        </div>
      }
    />
  );
}

function NoRisk() {
  return (
    <EmptyState
      icon={<CircleAlert className="h-7 w-7" strokeWidth={1.8} />}
      title="Noch kein Warnsignal"
      description="Aktuell gibt es keine Produkte mit klarem Bereuen-Signal."
      action={
        <PrimaryLink href="/check" icon={<Search className="h-4 w-4" />}>
          Produkt prüfen
        </PrimaryLink>
      }
    />
  );
}

function PrimaryLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="press inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 text-[0.9375rem] font-semibold text-primary-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="press inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-fill-2 px-4 text-[0.9375rem] font-semibold text-label"
    >
      {children}
    </Link>
  );
}
