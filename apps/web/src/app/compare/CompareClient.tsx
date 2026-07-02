'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  GitCompareArrows,
  Info,
  Layers3,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AspectStatDto, ProductDetailDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { productThumbUrl } from '@/lib/product-media';
import { productPath } from '@/lib/seo';
import { cn, scoreColor } from '@/lib/utils';
import { NetConsensusBadge } from '@/components/NetConsensusBadge';
import { ScoreRing } from '@/components/ScoreRing';
import { SealBadge } from '@/components/SealBadge';
import { EmptyState, Skeleton } from '@/components/states/States';

const MAX_COMPARE = 3;

type DecisionMode = 'balanced' | 'risk' | 'community';
type HighlightMode = 'max' | 'min' | 'none';

interface DecisionWeights {
  rebuy: number;
  regretSafety: number;
  confidence: number;
  trust: number;
  external: number;
}

/** What the decision score is actually based on — shown, never hidden. */
type DataBasis = 'owners' | 'external' | 'none';

interface ProductStats {
  product: ProductDetailDto;
  rebuy: number | null;
  regret: number | null;
  regretSafety: number;
  confidence: number;
  trust: number;
  external: number | null;
  decisionScore: number;
  basis: DataBasis;
  positive: AspectStatDto[];
  negative: AspectStatDto[];
}

interface Verdict {
  title: string;
  subtitle: string;
  leader: ProductStats;
  runnerUp: ProductStats;
  gap: number;
  decisive: boolean;
  reasons: string[];
}

interface MetricDefinition {
  key: string;
  label: string;
  hint: string;
  raw: (stats: ProductStats) => number | null;
  bar: (stats: ProductStats) => number | null;
  display: (stats: ProductStats) => string;
  highlight: HighlightMode;
  tone: 'rebuy' | 'regret' | 'neutral';
}

const MODES: Array<{
  key: DecisionMode;
  label: string;
  description: string;
  weights: DecisionWeights;
}> = [
  {
    key: 'balanced',
    label: 'Ausgewogen',
    description: 'Wiederkauf, Risiko und Datenlage gleich sauber abwägen.',
    weights: { rebuy: 0.43, regretSafety: 0.22, confidence: 0.18, trust: 0.1, external: 0.07 },
  },
  {
    key: 'risk',
    label: 'Sicherer Kauf',
    description: 'Regret, Verifikation und belastbare Besitzerbasis stärker gewichten.',
    weights: { rebuy: 0.28, regretSafety: 0.32, confidence: 0.22, trust: 0.14, external: 0.04 },
  },
  {
    key: 'community',
    label: 'Community-Favorit',
    description: 'Wiederkauf-Signal und Netz-Konsens stehen im Vordergrund.',
    weights: { rebuy: 0.5, regretSafety: 0.12, confidence: 0.14, trust: 0.06, external: 0.18 },
  },
];

const modeByKey = Object.fromEntries(MODES.map((mode) => [mode.key, mode])) as Record<
  DecisionMode,
  (typeof MODES)[number]
>;

const numberFormatter = new Intl.NumberFormat('de-DE');

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } },
};

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 34 } },
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function pct(value: number | null): string {
  return value === null ? 'Offen' : `${value}%`;
}

function getRebuy(product: ProductDetailDto): number | null {
  return product.insights.rebuyScore ?? product.rebuyScore;
}

function getRegret(product: ProductDetailDto): number | null {
  return product.insights.regretScore ?? product.regretScore;
}

function confidenceScore(product: ProductDetailDto): number {
  const experiences = product.insights.experienceCount;
  const owners = product.insights.ownerCount;
  const verification = product.insights.verification;
  const experienceScore = Math.min(44, Math.log10(experiences + 1) * 22);
  const ownerScore = Math.min(28, Math.log10(owners + 1) * 15);
  const verificationScore = Math.min(18, ((verification?.verifiedShare ?? 0) / 100) * 18);
  const breadthScore = product.externalSourceCount > 0 ? 10 : 0;
  return Math.round(clamp(experienceScore + ownerScore + verificationScore + breadthScore));
}

function trustScore(product: ProductDetailDto): number {
  const verification = product.insights.verification;
  const verifiedShare = verification?.verifiedShare ?? 0;
  const verifiedCount = verification?.verified ?? 0;
  const experienceCoverage = Math.min(28, product.insights.experienceCount * 2.8);
  const ownerCoverage = Math.min(12, Math.log10(product.insights.ownerCount + 1) * 6);
  const verifiedCountBonus = Math.min(10, verifiedCount * 2);
  return Math.round(
    clamp(verifiedShare * 0.5 + experienceCoverage + ownerCoverage + verifiedCountBonus),
  );
}

function buildProductStats(product: ProductDetailDto, mode: DecisionMode): ProductStats {
  const rebuy = getRebuy(product);
  const regret = getRegret(product);
  const regretSafety = regret === null ? null : 100 - regret;
  const confidence = confidenceScore(product);
  const trust = trustScore(product);
  const external = product.externalAvgPercent;
  const weights = modeByKey[mode].weights;

  // Only signals that actually exist enter the score — a missing rebuy value is
  // NOT pretended to be "48". The weights of missing signals are redistributed
  // across the present ones, so cold products are honestly carried by their
  // data confidence and Netz-Konsens instead of invented baselines.
  const parts: Array<{ value: number | null; weight: number }> = [
    { value: rebuy, weight: weights.rebuy },
    { value: regretSafety, weight: weights.regretSafety },
    { value: confidence, weight: weights.confidence },
    { value: trust, weight: weights.trust },
    { value: external, weight: weights.external },
  ];
  const present = parts.filter(
    (part): part is { value: number; weight: number } => part.value !== null,
  );
  const totalWeight = present.reduce((sum, part) => sum + part.weight, 0);
  const weighted =
    totalWeight > 0
      ? present.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight
      : 0;

  const basis: DataBasis =
    product.insights.experienceCount > 0
      ? 'owners'
      : product.externalSourceCount > 0
        ? 'external'
        : 'none';

  return {
    product,
    rebuy,
    regret,
    regretSafety: regretSafety ?? 52,
    confidence,
    trust,
    external,
    decisionScore: Math.round(clamp(weighted)),
    basis,
    positive: product.insights.topPositiveAspects.slice(0, 4),
    negative: product.insights.topNegativeAspects.slice(0, 4),
  };
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Noch offen';
  if (score >= 78) return 'Sehr stark';
  if (score >= 64) return 'Solide';
  if (score >= 48) return 'Gemischt';
  return 'Kritisch';
}

function dataLabel(stats: ProductStats): string {
  const count = stats.product.insights.experienceCount;
  if (count >= 50) return 'Sehr solide Datenlage';
  if (count >= 20) return 'Solide Datenlage';
  if (count > 0) return 'Frühes Signal';
  return 'Noch kaum Besitzerdaten';
}

function regretLabel(value: number | null): string {
  if (value === null) return 'Offen';
  if (value <= 18) return 'Niedrig';
  if (value <= 38) return 'Spürbar';
  return 'Hoch';
}

function compactUnique(items: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = item?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase('de-DE');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function productMeta(product: ProductSummaryDto): string {
  return [product.brand, product.category?.name].filter(Boolean).join(' · ') || 'Produkt';
}

function buildVerdict(stats: ProductStats[]): Verdict | null {
  if (stats.length < 2) return null;
  const sorted = [...stats].sort((a, b) => b.decisionScore - a.decisionScore);
  const leader = sorted[0]!;
  const runnerUp = sorted[1]!;
  const gap = leader.decisionScore - runnerUp.decisionScore;

  // No product has ANY data (no owners, no Netz-Konsens): say so instead of
  // crowning a winner from noise.
  if (stats.every((item) => item.basis === 'none')) {
    return {
      title: 'Noch zu wenig Daten für ein Fazit',
      subtitle:
        'Zu keinem der Produkte gibt es bisher Besitzerstimmen oder belastbare externe Quellen. Frag echte Besitzer oder gib die erste Erfahrung ab.',
      leader,
      runnerUp,
      gap,
      decisive: false,
      reasons: [
        'Keine Wudly-Besitzerstimmen vorhanden.',
        'Kein externer Netz-Konsens gefunden.',
        'Der Vergleich wird belastbar, sobald erste Daten da sind.',
      ],
    };
  }

  const decisive = gap >= 6;
  const close = gap < 3;
  const reasons = buildReasons(leader, runnerUp, close);
  const externalOnly = leader.basis === 'external';

  return {
    title: close
      ? 'Noch kein klarer Sieger'
      : decisive
        ? `${leader.product.canonicalName} ist der klarere Kauf`
        : `Leichter Vorteil für ${leader.product.canonicalName}`,
    subtitle: close
      ? 'Die Produkte liegen nah beieinander. Entscheidend ist hier, welches Risiko du vermeiden willst.'
      : decisive
        ? `Der Vorsprung beträgt ${gap} Punkte im aktuellen Entscheidungsmodell.${
            externalOnly
              ? ' Basis sind externe Quellen — Wudly-Besitzerstimmen fehlen noch.'
              : ''
          }`
        : `Der Vorsprung beträgt nur ${gap} Punkte. Prüfe die Kritikpunkte, bevor du dich festlegst.`,
    leader,
    runnerUp,
    gap,
    decisive,
    reasons,
  };
}

function buildReasons(leader: ProductStats, runnerUp: ProductStats, close: boolean): string[] {
  if (close) {
    return compactUnique(
      [
        'Die Gesamtwerte liegen sehr eng beieinander.',
        leader.rebuy !== null && runnerUp.rebuy !== null
          ? `Wiederkauf: ${leader.product.canonicalName} ${leader.rebuy}%, ${runnerUp.product.canonicalName} ${runnerUp.rebuy}%.`
          : undefined,
        'Die bessere Wahl hängt stärker von Nutzung und Kritikpunkten ab als vom Gesamtscore.',
      ],
      3,
    );
  }

  return compactUnique(
    [
      leader.rebuy !== null && runnerUp.rebuy !== null && leader.rebuy - runnerUp.rebuy >= 8
        ? `${leader.rebuy - runnerUp.rebuy} Punkte stärker beim Wiederkauf-Signal.`
        : undefined,
      leader.regret !== null && runnerUp.regret !== null && runnerUp.regret - leader.regret >= 8
        ? `${runnerUp.regret - leader.regret} Punkte weniger Regret-Risiko.`
        : undefined,
      leader.confidence - runnerUp.confidence >= 10
        ? 'Belastbarere Datenbasis aus Besitzerstimmen und Quellen.'
        : undefined,
      leader.trust - runnerUp.trust >= 10
        ? 'Besser abgesicherte Besitzer- und Verifikationslage.'
        : undefined,
      leader.external !== null &&
      runnerUp.external !== null &&
      leader.external - runnerUp.external >= 8
        ? 'Stärkerer externer Netz-Konsens.'
        : undefined,
      'Im Gesamtbild die bessere Kombination aus Signal, Risiko und Datenlage.',
    ],
    3,
  );
}

function isProduct(value: ProductDetailDto | undefined): value is ProductDetailDto {
  return Boolean(value);
}

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') ?? '';
  const reduced = useReducedMotion();

  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  const [products, setProducts] = useState<Record<string, ProductDetailDto>>({});
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(ids.length === 0);
  const [mode, setMode] = useState<DecisionMode>('balanced');

  useEffect(() => {
    const missing = ids.filter((id) => !products[id]);
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(
      missing.map((id) =>
        api.products
          .get(id, { cache: 'no-store' })
          .then((product) => [id, product] as const)
          .catch(() => null),
      ),
    )
      .then((results) => {
        setProducts((prev) => {
          const next = { ...prev };
          for (const result of results) {
            if (result) next[result[0]] = result[1];
          }
          return next;
        });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const setIds = useCallback(
    (next: string[]) => {
      const unique = Array.from(new Set(next)).slice(0, MAX_COMPARE);
      const query = unique.length > 0 ? `?ids=${unique.join(',')}` : '';
      router.replace(`/compare${query}`);
    },
    [router],
  );

  const add = (id: string) => {
    if (ids.includes(id)) return;
    setIds([...ids, id]);
    setPicking(false);
  };

  const remove = (id: string) => {
    const next = ids.filter((productId) => productId !== id);
    setIds(next);
    if (next.length === 0) setPicking(true);
  };

  const selected = ids.map((id) => products[id]).filter(isProduct);
  const stats = useMemo(
    () => selected.map((product) => buildProductStats(product, mode)),
    [selected, mode],
  );
  const statsById = useMemo(
    () => new Map(stats.map((item) => [item.product.id, item] as const)),
    [stats],
  );
  const verdict = useMemo(() => buildVerdict(stats), [stats]);

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-5 pb-8 pt-3"
      variants={container}
      initial={reduced ? false : 'hidden'}
      animate="show"
    >
      <motion.section
        variants={rise}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-stretch"
      >
        <div className="premium-panel relative overflow-hidden rounded-[var(--radius-xl)] px-5 py-5 shadow-[var(--shadow-elevated)] sm:px-6 sm:py-6">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <div className="relative max-w-2xl">
            <p className="mono-data inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
              <Sparkles className="h-4 w-4" strokeWidth={2.3} />
              Wudly Vergleich
            </p>
            <h1 className="font-display mt-3 max-w-3xl text-balance text-[2.45rem] leading-[0.98] text-white sm:text-[3.25rem]">
              Produktvergleich, der wirklich entscheidet.
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-[1rem] leading-relaxed text-white/70">
              Vergleiche Produkte nach echten Besitzerstimmen, Regret-Risiko, Datenlage und
              Netz-Konsens. Kein Datenblatt-Theater, sondern eine klare Kaufentscheidung.
            </p>
          </div>

          <div className="relative mt-6 grid gap-2.5 sm:grid-cols-3">
            <HeroMetric
              icon={GitCompareArrows}
              label="Produkte"
              value={`${selected.length}/${MAX_COMPARE}`}
            />
            <HeroMetric icon={ShieldCheck} label="Modell" value={modeByKey[mode].label} compact />
            <HeroMetric
              icon={BarChart3}
              label="Fazit"
              value={verdict ? (verdict.gap < 3 ? 'Knapp' : 'Aktiv') : 'Wählen'}
              compact
            />
          </div>
        </div>

        <CompareBuilder
          ids={ids}
          products={products}
          statsById={statsById}
          loading={loading}
          onRemove={remove}
          onAddClick={() => setPicking(true)}
        />
      </motion.section>

      <motion.section variants={rise}>
        <ModeSelector mode={mode} onModeChange={setMode} />
      </motion.section>

      <AnimatePresence initial={false}>
        {(picking || ids.length === 0) && (
          <motion.section
            key="picker"
            variants={rise}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
          >
            <ProductPicker excluded={ids} onPick={add} onClose={() => setPicking(false)} />
          </motion.section>
        )}
      </AnimatePresence>

      {selected.length === 0 && !loading ? (
        <motion.section variants={rise} className="card">
          <EmptyState
            icon={<Layers3 className="h-7 w-7" strokeWidth={1.8} />}
            title="Starte mit zwei Produkten"
            description="Suche nach Produkt A, füge Produkt B hinzu und Wudly baut daraus eine klare Entscheidung."
            action={
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="press inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[0.9375rem] font-semibold text-primary-foreground"
              >
                <Search className="h-4 w-4" strokeWidth={2.3} />
                Produkt suchen
              </button>
            }
          />
        </motion.section>
      ) : selected.length < 2 ? (
        <motion.section variants={rise} className="card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.8rem] bg-accent-soft text-accent-ink">
              <Plus className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[1.45rem] leading-tight text-label">
                Ein zweites Produkt fehlt noch.
              </p>
              <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
                Ab zwei Produkten zeigt Wudly ein Fazit, konkrete Unterschiede und die
                Entscheidungsmatrix.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="press hidden h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-[0.875rem] font-semibold text-white sm:inline-flex"
            >
              Hinzufügen
            </button>
          </div>
        </motion.section>
      ) : (
        <>
          {verdict && (
            <motion.section variants={rise}>
              <DecisionPanel verdict={verdict} mode={mode} />
            </motion.section>
          )}

          <motion.section variants={rise}>
            <RecommendationCards stats={stats} verdict={verdict} />
          </motion.section>

          <motion.section variants={rise}>
            <CompareMatrix stats={stats} mode={mode} />
          </motion.section>

          <motion.section variants={rise}>
            <SpecsComparison stats={stats} />
          </motion.section>

          <motion.section variants={rise}>
            <InsightComparison stats={stats} />
          </motion.section>

          <motion.section variants={rise}>
            <MethodologyPanel />
          </motion.section>
        </>
      )}

      {loading && selected.length < ids.length && (
        <motion.section variants={rise}>
          <Skeleton className="h-44 rounded-[var(--radius-xl)]" />
        </motion.section>
      )}
    </motion.div>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  compact,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[0.95rem] bg-white/[0.07] px-3.5 py-3 ring-1 ring-white/10">
      <div className="flex items-center gap-2 text-white/60">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
        <span className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p
        className={cn(
          'mt-2 truncate font-display leading-none text-white',
          compact ? 'text-[1.25rem]' : 'text-[1.7rem]',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CompareBuilder({
  ids,
  products,
  statsById,
  loading,
  onRemove,
  onAddClick,
}: {
  ids: string[];
  products: Record<string, ProductDetailDto>;
  statsById: Map<string, ProductStats>;
  loading: boolean;
  onRemove: (id: string) => void;
  onAddClick: () => void;
}) {
  const slots = Array.from({ length: MAX_COMPARE }, (_, index) => ids[index] ?? null);

  return (
    <div className="card-elevated flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Vergleich bauen
          </p>
          <h2 className="font-display mt-1 text-[1.65rem] leading-none text-label">Produkte</h2>
        </div>
        {ids.length < MAX_COMPARE && (
          <button
            type="button"
            onClick={onAddClick}
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[var(--shadow-glow)]"
            aria-label="Produkt hinzufügen"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        )}
      </div>

      <div className="mt-4 grid flex-1 gap-2.5">
        {slots.map((id, index) => {
          const product = id ? products[id] : null;
          if (id && !product) {
            return <ProductSlotSkeleton key={id} />;
          }
          if (!product) {
            return (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={onAddClick}
                className="press flex min-h-[5.5rem] items-center justify-center gap-2 rounded-[0.9rem] border border-dashed border-border-strong bg-fill text-[0.9375rem] font-semibold text-muted-foreground"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Produkt hinzufügen
              </button>
            );
          }
          return (
            <ProductSlotCard
              key={product.id}
              product={product}
              stats={statsById.get(product.id)}
              onRemove={() => onRemove(product.id)}
            />
          );
        })}
      </div>

      {loading && (
        <p className="mono-data mt-3 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Produktdaten werden geladen
        </p>
      )}
    </div>
  );
}

function ProductSlotSkeleton() {
  return (
    <div className="flex min-h-[5.5rem] items-center gap-3 rounded-[0.9rem] bg-fill p-3">
      <Skeleton className="h-14 w-14 rounded-[0.75rem]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-9 w-9 rounded-full" />
    </div>
  );
}

function ProductSlotCard({
  product,
  stats,
  onRemove,
}: {
  product: ProductDetailDto;
  stats?: ProductStats;
  onRemove: () => void;
}) {
  return (
    <motion.div
      layout
      className="group relative rounded-[0.95rem] bg-fill p-3 ring-1 ring-border"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
    >
      <button
        type="button"
        onClick={onRemove}
        className="tap-dim absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-muted-foreground shadow-[0_0_0_1px_var(--color-border)] backdrop-blur"
        aria-label={`${product.canonicalName} entfernen`}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.8} />
      </button>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productThumbUrl(product)}
          alt=""
          className="h-16 w-16 shrink-0 rounded-[0.8rem] bg-surface-muted object-contain p-1 ring-1 ring-border"
        />
        <div className="min-w-0 flex-1 pr-8">
          <p className="truncate text-[0.8125rem] text-muted-foreground">{productMeta(product)}</p>
          <Link
            href={productPath(product)}
            className="group/link mt-0.5 flex min-w-0 items-start gap-1 text-label"
          >
            <span className="line-clamp-2 text-[1rem] font-semibold leading-tight">
              {product.canonicalName}
            </span>
            <ChevronRight
              className="mt-0.5 h-4 w-4 shrink-0 text-label-3 transition-transform group-hover/link:translate-x-0.5"
              strokeWidth={2.4}
            />
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {product.wudlySeal && <SealBadge />}
            <NetConsensusBadge
              avgPercent={product.externalAvgPercent}
              sourceCount={product.externalSourceCount}
            />
          </div>
        </div>
        <div className="hidden shrink-0 sm:block">
          <ScoreRing score={stats?.decisionScore ?? null} size={58} animate={false} />
        </div>
      </div>
    </motion.div>
  );
}

function ModeSelector({
  mode,
  onModeChange,
}: {
  mode: DecisionMode;
  onModeChange: (mode: DecisionMode) => void;
}) {
  return (
    <div className="card p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.75rem] bg-accent-soft text-accent-ink">
          <SlidersHorizontal className="h-4.5 w-4.5" strokeWidth={2.2} />
        </span>
        <div>
          <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Entscheidungsmodell
          </p>
          <p className="text-[0.875rem] leading-snug text-muted-foreground">
            Passe an, was dir bei diesem Vergleich wichtiger ist.
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Entscheidungsmodell">
        {MODES.map((item) => {
          const active = item.key === mode;
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onModeChange(item.key)}
              className={cn(
                'press relative overflow-hidden rounded-[0.9rem] px-3 py-3 text-left ring-1 transition-colors',
                active
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-fill text-label ring-border hover:bg-fill-2',
              )}
            >
              {active && (
                <motion.span
                  layoutId="compare-mode-active"
                  className="absolute inset-0 bg-primary"
                  transition={{ type: 'spring', stiffness: 480, damping: 42 }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className="font-semibold">{item.label}</span>
                {active && <Check className="h-4 w-4" strokeWidth={2.5} />}
              </span>
              <span
                className={cn(
                  'relative mt-1.5 block text-[0.8125rem] leading-snug',
                  active ? 'text-primary-foreground/68' : 'text-muted-foreground',
                )}
              >
                {item.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductPicker({
  excluded,
  onPick,
  onClose,
}: {
  excluded: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.products
        .search(query, 10, { cache: 'no-store' })
        .then((items) => setResults(items.filter((product) => !excludedSet.has(product.id))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 240);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, excludedSet]);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
              Produkt hinzufügen
            </p>
            <h2 className="font-display mt-1 text-[1.65rem] leading-none text-label">
              Suche im Katalog
            </h2>
          </div>
          {excluded.length > 0 && (
            <button
              type="button"
              onClick={onClose}
              className="tap-dim rounded-full px-2 py-1 text-[0.875rem] font-semibold text-accent-ink"
            >
              Fertig
            </button>
          )}
        </div>

        <label className="mt-4 flex h-12 items-center gap-2.5 rounded-[0.95rem] bg-fill-2 px-3 ring-1 ring-border focus-within:ring-accent">
          <Search className="h-[1.1rem] w-[1.1rem] shrink-0 text-faint" strokeWidth={2.2} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Produkt, Marke oder Kategorie suchen..."
            className="h-full min-w-0 flex-1 bg-transparent text-[1.0625rem] text-label outline-none placeholder:text-faint"
            inputMode="search"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="tap-dim grid h-7 w-7 place-items-center rounded-full bg-fill text-muted-foreground"
              aria-label="Suche leeren"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.7} />
            </button>
          )}
        </label>
      </div>

      <div className="px-4 pb-4">
        {loading && <Skeleton className="h-16 rounded-[0.95rem]" />}

        <AnimatePresence initial={false}>
          {results && results.length > 0 && (
            <motion.div
              key="results"
              className="overflow-hidden rounded-[0.95rem] bg-fill"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              {results.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onPick(product.id)}
                  className={cn(
                    'tap group flex w-full items-center gap-3 px-3 py-3 text-left',
                    index < results.length - 1 && 'hairline',
                  )}
                  style={{ ['--hairline-inset' as string]: '4.5rem' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productThumbUrl(product)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-[0.75rem] bg-surface-muted object-contain p-1 ring-1 ring-border"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold text-label">
                      {product.canonicalName}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">
                      {productMeta(product)}
                    </span>
                  </span>
                  <span className="mono-data hidden shrink-0 text-[0.8125rem] font-semibold text-muted-foreground sm:block">
                    {pct(product.rebuyScore)}
                  </span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink transition-transform group-hover:scale-105">
                    <Plus className="h-4.5 w-4.5" strokeWidth={2.6} />
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {results && results.length === 0 && !loading && (
          <div className="rounded-[0.95rem] bg-fill px-4 py-4">
            <p className="font-semibold text-label">Nichts gefunden.</p>
            <p className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
              Prüfe das Produkt zuerst in Wudly und lege es bei Bedarf neu an.
            </p>
            <Link
              href="/check"
              className="press mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[0.875rem] font-semibold text-primary-foreground"
            >
              Zum Produktcheck
              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionPanel({ verdict, mode }: { verdict: Verdict; mode: DecisionMode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="card-elevated relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-positive via-accent to-unsure"
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mono-data flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
              <Trophy className="h-4 w-4" strokeWidth={2.3} />
              Klares Fazit
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-balance text-[2rem] leading-[1.02] text-label sm:text-[2.45rem]">
              {verdict.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[0.9875rem] leading-relaxed text-muted-foreground">
              {verdict.subtitle}
            </p>
          </div>
          <div className="shrink-0 rounded-[1rem] bg-fill p-3 text-center">
            <ScoreRing score={verdict.leader.decisionScore} size={92} label="Entscheidung" />
          </div>
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {verdict.reasons.map((reason) => (
            <div key={reason} className="rounded-[0.9rem] bg-fill px-3 py-3">
              <p className="text-[0.9rem] leading-snug text-label">{reason}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Modell aktiv
        </p>
        <p className="font-display mt-2 text-[1.65rem] leading-none text-label">
          {modeByKey[mode].label}
        </p>
        <p className="mt-2 text-[0.9rem] leading-snug text-muted-foreground">
          {modeByKey[mode].description}
        </p>
        <div className="mt-4 space-y-2">
          <WeightLine label="Wiederkauf" value={modeByKey[mode].weights.rebuy} />
          <WeightLine label="Regret-Sicherheit" value={modeByKey[mode].weights.regretSafety} />
          <WeightLine label="Datenlage" value={modeByKey[mode].weights.confidence} />
          <WeightLine label="Vertrauen" value={modeByKey[mode].weights.trust} />
        </div>
      </div>
    </div>
  );
}

function WeightLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
        <span className="text-muted-foreground">{label}</span>
        <span className="mono-data font-semibold text-label">{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill-2">
        <motion.span
          className="block h-full origin-left rounded-full bg-accent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: value }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function RecommendationCards({
  stats,
  verdict,
}: {
  stats: ProductStats[];
  verdict: Verdict | null;
}) {
  return (
    <div>
      <SectionHeader
        icon={Zap}
        eyebrow="Kaufentscheidung"
        title="Wann welches Produkt sinnvoll ist"
        description="Die Karten übersetzen die Signale in konkrete Nutzungssituationen."
      />
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {stats.map((item) => {
          const isLeader = verdict?.leader.product.id === item.product.id && verdict.gap >= 3;
          return <RecommendationCard key={item.product.id} stats={item} leader={isLeader} />;
        })}
      </div>
    </div>
  );
}

function RecommendationCard({ stats, leader }: { stats: ProductStats; leader: boolean }) {
  const takeItems = compactUnique(
    [
      ...stats.product.insights.suitedFor.slice(0, 2),
      ...stats.positive.map(
        (aspect) => `Wenn dir ${aspect.label.toLocaleLowerCase('de-DE')} wichtig ist`,
      ),
      stats.rebuy !== null && stats.rebuy >= 75
        ? 'du ein starkes Wiederkauf-Signal willst'
        : undefined,
      stats.trust >= 62 ? 'dir verifizierte Besitzerstimmen wichtig sind' : undefined,
    ],
    3,
  );
  const avoidItems = compactUnique(
    [
      ...stats.product.insights.notSuitedFor.slice(0, 2),
      ...stats.negative.map(
        (aspect) => `Wenn dich ${aspect.label.toLocaleLowerCase('de-DE')} stört`,
      ),
      stats.product.insights.insteadOfShare >= 22
        ? `${stats.product.insights.insteadOfShare}% nennen lieber eine Alternative`
        : undefined,
    ],
    3,
  );
  const questionItems = compactUnique(
    [
      ...stats.product.insights.wishKnownHighlights.slice(0, 2),
      stats.negative[0]
        ? `Wie stark fällt ${stats.negative[0].label.toLocaleLowerCase('de-DE')} im Alltag auf?`
        : undefined,
      'Wie hält es sich nach mehreren Monaten Nutzung?',
    ],
    3,
  );

  return (
    <article className="card flex flex-col p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productThumbUrl(stats.product)}
          alt=""
          className="h-14 w-14 shrink-0 rounded-[0.8rem] bg-surface-muted object-contain p-1 ring-1 ring-border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'mono-data rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em]',
                leader ? 'bg-positive-soft text-positive-ink' : 'bg-fill-2 text-muted-foreground',
              )}
            >
              {leader ? 'Vorteil' : scoreLabel(stats.rebuy)}
            </span>
            {stats.basis !== 'owners' && (
              <span className="mono-data rounded-full bg-fill-2 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {stats.basis === 'external' ? 'Basis: Netz' : 'Keine Daten'}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-[1.0625rem] font-semibold leading-tight text-label">
            {stats.product.canonicalName}
          </h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Wudly" value={pct(stats.rebuy)} tone="positive" />
        <MiniMetric label="Regret" value={pct(stats.regret)} tone="negative" />
        <MiniMetric label="Daten" value={`${stats.confidence}`} tone="neutral" />
      </div>

      <DecisionList
        className="mt-4"
        icon={ThumbsUp}
        title="Nimm es, wenn"
        tone="positive"
        items={
          takeItems.length > 0
            ? takeItems
            : ['du erst noch mehr echte Besitzerstimmen sammeln willst']
        }
      />
      <DecisionList
        className="mt-4"
        icon={ThumbsDown}
        title="Nicht ideal, wenn"
        tone="negative"
        items={
          avoidItems.length > 0 ? avoidItems : ['du die Datenlage noch nicht stark genug findest']
        }
      />
      <DecisionList
        className="mt-4"
        icon={CircleHelp}
        title="Vorher klären"
        tone="neutral"
        items={questionItems}
      />
    </article>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass = {
    positive: 'text-positive-ink bg-positive-soft',
    negative: 'text-regret-ink bg-regret-soft',
    neutral: 'text-label bg-fill-2',
  }[tone];
  return (
    <div className={cn('rounded-[0.75rem] px-2 py-2 text-center', toneClass)}>
      <p className="mono-data text-[0.5625rem] font-semibold uppercase tracking-[0.1em] opacity-75">
        {label}
      </p>
      <p className="font-display mt-1 truncate text-[1.15rem] leading-none">{value}</p>
    </div>
  );
}

function DecisionList({
  icon: Icon,
  title,
  items,
  tone,
  className,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  tone: 'positive' | 'negative' | 'neutral';
  className?: string;
}) {
  const color =
    tone === 'positive'
      ? 'text-positive-ink'
      : tone === 'negative'
        ? 'text-regret-ink'
        : 'text-accent-ink';
  const dot = tone === 'positive' ? 'bg-positive' : tone === 'negative' ? 'bg-regret' : 'bg-accent';

  return (
    <div className={className}>
      <p
        className={cn(
          'mono-data flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]',
          color,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
        {title}
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[0.9rem] leading-snug text-label">
            <span className={cn('mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompareMatrix({ stats, mode }: { stats: ProductStats[]; mode: DecisionMode }) {
  const maxExperience = Math.max(...stats.map((item) => item.product.insights.experienceCount), 1);
  const maxOwners = Math.max(...stats.map((item) => item.product.insights.ownerCount), 1);
  const definitions: MetricDefinition[] = [
    {
      key: 'decision',
      label: 'Entscheidungswert',
      hint: `${modeByKey[mode].label}: gewichtete Empfehlung für diesen Vergleich.`,
      raw: (item) => item.decisionScore,
      bar: (item) => item.decisionScore,
      display: (item) => `${item.decisionScore}/100`,
      highlight: 'max',
      tone: 'rebuy',
    },
    {
      key: 'rebuy',
      label: 'Wiederkauf',
      hint: 'Anteil echter Besitzer, die es wieder kaufen würden.',
      raw: (item) => item.rebuy,
      bar: (item) => item.rebuy,
      display: (item) => pct(item.rebuy),
      highlight: 'max',
      tone: 'rebuy',
    },
    {
      key: 'regret',
      label: 'Regret-Risiko',
      hint: 'Je niedriger, desto besser. Zeigt enttäuschte oder bereuende Nutzung.',
      raw: (item) => item.regret,
      bar: (item) => (item.regret === null ? null : 100 - item.regret),
      display: (item) => `${pct(item.regret)} · ${regretLabel(item.regret)}`,
      highlight: 'min',
      tone: 'regret',
    },
    {
      key: 'confidence',
      label: 'Datenlage',
      hint: 'Erfahrungen, Besitzer, Verifikation und externe Quellen als Belastbarkeit.',
      raw: (item) => item.confidence,
      bar: (item) => item.confidence,
      display: (item) => `${item.confidence}/100 · ${dataLabel(item)}`,
      highlight: 'max',
      tone: 'neutral',
    },
    {
      key: 'owners',
      label: 'Besitzer',
      hint: 'Wie viele Besitzer hinter dem Signal stehen.',
      raw: (item) => item.product.insights.ownerCount,
      bar: (item) => (item.product.insights.ownerCount / maxOwners) * 100,
      display: (item) => formatCount(item.product.insights.ownerCount),
      highlight: 'max',
      tone: 'neutral',
    },
    {
      key: 'experiences',
      label: 'Erfahrungen',
      hint: 'Ausformulierte Nutzungserfahrungen in Wudly.',
      raw: (item) => item.product.insights.experienceCount,
      bar: (item) => (item.product.insights.experienceCount / maxExperience) * 100,
      display: (item) => formatCount(item.product.insights.experienceCount),
      highlight: 'max',
      tone: 'neutral',
    },
    {
      key: 'verified',
      label: 'Verifiziert',
      hint: 'Anteil verifizierter Besitzer. Selbst deklarierte Stimmen bleiben sichtbar.',
      raw: (item) => item.product.insights.verification?.verifiedShare ?? 0,
      bar: (item) => item.product.insights.verification?.verifiedShare ?? 0,
      display: (item) => pct(item.product.insights.verification?.verifiedShare ?? 0),
      highlight: 'max',
      tone: 'neutral',
    },
    {
      key: 'external',
      label: 'Netz-Konsens',
      hint: 'Externe Bewertungsfakten. Zählt nicht in das neutrale Wudly Signal.',
      raw: (item) => item.external,
      bar: (item) => item.external,
      display: (item) =>
        item.external === null
          ? 'Keine Quellen'
          : `${item.external}% · ${item.product.externalSourceCount} ${
              item.product.externalSourceCount === 1 ? 'Quelle' : 'Quellen'
            }`,
      highlight: 'max',
      tone: 'neutral',
    },
    {
      key: 'alternatives',
      label: 'Alternative genannt',
      hint: 'Anteil der Besitzer, die lieber etwas anderes gekauft hätten.',
      raw: (item) => item.product.insights.insteadOfShare,
      bar: (item) => 100 - item.product.insights.insteadOfShare,
      display: (item) => pct(item.product.insights.insteadOfShare),
      highlight: 'min',
      tone: 'regret',
    },
  ];

  return (
    <div>
      <SectionHeader
        icon={BarChart3}
        eyebrow="Matrix"
        title="Alle relevanten Kriterien"
        description="Desktop als Vergleichstabelle, mobil als lesbare Kriterienkarten."
      />
      <div className="mt-3 hidden overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[0_0_0_1px_var(--color-border),var(--shadow-card)] md:block">
        <MatrixHeader stats={stats} />
        {definitions.map((definition) => (
          <MetricDesktopRow key={definition.key} definition={definition} stats={stats} />
        ))}
      </div>
      <div className="mt-3 space-y-3 md:hidden">
        {definitions.map((definition) => (
          <MetricMobileCard key={definition.key} definition={definition} stats={stats} />
        ))}
      </div>
    </div>
  );
}

function MatrixHeader({ stats }: { stats: ProductStats[] }) {
  const gridTemplateColumns = `minmax(12rem, 15rem) repeat(${stats.length}, minmax(0, 1fr))`;
  return (
    <div
      className="sticky top-[3rem] z-10 grid items-stretch gap-0 bg-surface/95 backdrop-blur-xl hairline"
      style={{ gridTemplateColumns }}
    >
      <div className="p-4">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Kriterium
        </p>
      </div>
      {stats.map((item) => (
        <Link
          key={item.product.id}
          href={productPath(item.product)}
          className="tap flex items-center gap-3 border-l border-border p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productThumbUrl(item.product)}
            alt=""
            className="h-11 w-11 shrink-0 rounded-[0.7rem] bg-surface-muted object-contain p-1 ring-1 ring-border"
          />
          <span className="min-w-0">
            <span className="block line-clamp-2 text-[0.875rem] font-semibold leading-tight text-label">
              {item.product.canonicalName}
            </span>
            <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">
              {productMeta(item.product)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function MetricDesktopRow({
  definition,
  stats,
}: {
  definition: MetricDefinition;
  stats: ProductStats[];
}) {
  const gridTemplateColumns = `minmax(12rem, 15rem) repeat(${stats.length}, minmax(0, 1fr))`;
  const best = bestMetricValue(definition, stats);

  return (
    <div className="grid min-h-[5.25rem] hairline" style={{ gridTemplateColumns }}>
      <div className="flex flex-col justify-center p-4">
        <p className="font-semibold text-label">{definition.label}</p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
          {definition.hint}
        </p>
      </div>
      {stats.map((item) => (
        <MetricCell
          key={item.product.id}
          definition={definition}
          stats={item}
          best={best}
          className="border-l border-border p-4"
        />
      ))}
    </div>
  );
}

function MetricMobileCard({
  definition,
  stats,
}: {
  definition: MetricDefinition;
  stats: ProductStats[];
}) {
  const best = bestMetricValue(definition, stats);
  return (
    <div className="card overflow-hidden">
      <div className="p-4 hairline">
        <p className="font-semibold text-label">{definition.label}</p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
          {definition.hint}
        </p>
      </div>
      {stats.map((item, index) => (
        <MetricCell
          key={item.product.id}
          definition={definition}
          stats={item}
          best={best}
          className={cn('px-4 py-3', index < stats.length - 1 && 'hairline')}
        />
      ))}
    </div>
  );
}

function MetricCell({
  definition,
  stats,
  best,
  className,
}: {
  definition: MetricDefinition;
  stats: ProductStats;
  best: number | null;
  className?: string;
}) {
  const raw = definition.raw(stats);
  const bar = definition.bar(stats);
  const isBest = best !== null && raw !== null && raw === best;
  const color = metricColor(definition, raw);

  return (
    <div className={cn('flex min-w-0 flex-col justify-center', className)}>
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <div className="min-w-0 md:hidden">
          <p className="line-clamp-1 text-[0.875rem] font-semibold text-label">
            {stats.product.canonicalName}
          </p>
        </div>
        <p
          className="mono-data shrink-0 text-[1rem] font-semibold tnum text-label"
          style={{ color }}
        >
          {definition.display(stats)}
        </p>
        {isBest && (
          <span className="mono-data shrink-0 rounded-full bg-positive-soft px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-positive-ink">
            Best
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-2">
        {bar !== null && (
          <motion.span
            className="block h-full origin-left rounded-full"
            style={{ backgroundColor: color }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: clamp(bar) / 100 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </div>
    </div>
  );
}

function bestMetricValue(definition: MetricDefinition, stats: ProductStats[]): number | null {
  if (definition.highlight === 'none') return null;
  const values = stats.map(definition.raw).filter((value): value is number => value !== null);
  if (values.length < 2 || new Set(values).size < 2) return null;
  return definition.highlight === 'max' ? Math.max(...values) : Math.min(...values);
}

function metricColor(definition: MetricDefinition, raw: number | null): string {
  if (definition.tone === 'neutral') return 'var(--color-label)';
  if (definition.tone === 'regret') {
    if (raw === null) return 'var(--color-faint)';
    return raw <= 22
      ? 'var(--color-positive)'
      : raw <= 40
        ? 'var(--color-unsure)'
        : 'var(--color-regret)';
  }
  return scoreColor(raw, 'rebuy');
}

/**
 * Side-by-side technical facts. Rows are the union of all spec labels, the ones
 * every product carries first (those are the comparable ones), and cells whose
 * value differs from the others are highlighted — the actual decision points.
 */
function SpecsComparison({ stats }: { stats: ProductStats[] }) {
  const rows = useMemo(() => {
    const order: string[] = [];
    const byLabel = new Map<string, Map<string, string>>();
    for (const item of stats) {
      for (const spec of item.product.specs) {
        const key = spec.label.trim().toLocaleLowerCase('de-DE');
        if (!key) continue;
        if (!byLabel.has(key)) {
          byLabel.set(key, new Map());
          order.push(key);
        }
        const values = byLabel.get(key)!;
        if (!values.has('__label')) values.set('__label', spec.label.trim());
        if (!values.has(item.product.id)) values.set(item.product.id, spec.value);
      }
    }
    return order
      .map((key) => {
        const values = byLabel.get(key)!;
        const coverage = stats.filter((item) => values.has(item.product.id)).length;
        return { key, label: values.get('__label') ?? key, values, coverage };
      })
      .sort((a, b) => b.coverage - a.coverage)
      .slice(0, 12);
  }, [stats]);

  if (rows.length === 0) return null;

  const gridTemplateColumns = `minmax(9rem, 12rem) repeat(${stats.length}, minmax(0, 1fr))`;

  return (
    <div>
      <SectionHeader
        icon={Layers3}
        eyebrow="Technische Daten"
        title="Specs im direkten Vergleich"
        description="Fakten aus Herstellerdaten und Katalogen. Unterschiede sind markiert."
      />
      <div className="card mt-3 overflow-x-auto">
        <div style={{ minWidth: `${9 + stats.length * 10}rem` }}>
          <div
            className="grid items-center hairline"
            style={{ gridTemplateColumns }}
          >
            <div className="px-4 py-2.5" />
            {stats.map((item) => (
              <p
                key={item.product.id}
                className="line-clamp-1 border-l border-border px-3 py-2.5 text-[0.75rem] font-semibold text-label"
              >
                {item.product.canonicalName}
              </p>
            ))}
          </div>
          {rows.map((row, rowIndex) => {
            const distinct = new Set(
              stats
                .map((item) => row.values.get(item.product.id))
                .filter((value): value is string => Boolean(value))
                .map((value) => value.toLocaleLowerCase('de-DE')),
            );
            const differs = distinct.size > 1;
            return (
              <div
                key={row.key}
                className={cn('grid items-center', rowIndex < rows.length - 1 && 'hairline')}
                style={{ gridTemplateColumns }}
              >
                <div className="px-4 py-3">
                  <p className="text-[0.8125rem] font-semibold text-muted-foreground">{row.label}</p>
                </div>
                {stats.map((item) => {
                  const value = row.values.get(item.product.id);
                  return (
                    <div key={item.product.id} className="border-l border-border px-3 py-3">
                      <p
                        className={cn(
                          'text-[0.875rem] leading-snug',
                          !value ? 'text-faint' : differs ? 'font-semibold text-label' : 'text-muted-foreground',
                        )}
                      >
                        {value ?? '–'}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 px-1 text-[0.75rem] leading-snug text-muted-foreground">
        Fett markierte Werte unterscheiden sich zwischen den Produkten.
      </p>
    </div>
  );
}

function InsightComparison({ stats }: { stats: ProductStats[] }) {
  return (
    <div>
      <SectionHeader
        icon={Sparkles}
        eyebrow="Unterschiede"
        title="Was im Alltag wirklich zählt"
        description="Die wichtigsten Stärken, Schwächen und offenen Fragen nebeneinander."
      />
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <InsightColumn
          title="Stärken"
          icon={ThumbsUp}
          tone="positive"
          stats={stats}
          items={(item) =>
            item.positive.length > 0
              ? item.positive.map((aspect) => `${aspect.label} (${aspect.count}×)`)
              : (item.product.externalConsensus?.positiveThemes ?? []).map(
                  (theme) => `${theme.label} · Netz`,
                )
          }
          empty="Noch keine klaren Stärken."
        />
        <InsightColumn
          title="Kritik"
          icon={ThumbsDown}
          tone="negative"
          stats={stats}
          items={(item) =>
            item.negative.length > 0
              ? item.negative.map((aspect) => `${aspect.label} (${aspect.count}×)`)
              : (item.product.externalConsensus?.negativeThemes ?? []).map(
                  (theme) => `${theme.label} · Netz`,
                )
          }
          empty="Noch keine klare Kritik."
        />
        <InsightColumn
          title="Vorher wissen"
          icon={CircleHelp}
          tone="neutral"
          stats={stats}
          items={(item) => item.product.insights.wishKnownHighlights.slice(0, 4)}
          empty="Noch keine Hinweise."
        />
      </div>
      <p className="mt-2 px-1 text-[0.75rem] leading-snug text-muted-foreground">
        Einträge mit „Netz“ stammen aus externen, verlinkten Quellen — nicht aus dem Wudly Signal.
      </p>
    </div>
  );
}

function InsightColumn({
  title,
  icon: Icon,
  tone,
  stats,
  items,
  empty,
}: {
  title: string;
  icon: LucideIcon;
  tone: 'positive' | 'negative' | 'neutral';
  stats: ProductStats[];
  items: (stats: ProductStats) => string[];
  empty: string;
}) {
  const color =
    tone === 'positive'
      ? 'text-positive-ink'
      : tone === 'negative'
        ? 'text-regret-ink'
        : 'text-accent-ink';
  const dot = tone === 'positive' ? 'bg-positive' : tone === 'negative' ? 'bg-regret' : 'bg-accent';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 hairline">
        <Icon className={cn('h-4.5 w-4.5', color)} strokeWidth={2.2} />
        <h3 className="font-semibold text-label">{title}</h3>
      </div>
      {stats.map((item, index) => {
        const list = items(item).slice(0, 4);
        return (
          <div
            key={item.product.id}
            className={cn('px-4 py-3', index < stats.length - 1 && 'hairline')}
          >
            <p className="line-clamp-1 text-[0.875rem] font-semibold text-label">
              {item.product.canonicalName}
            </p>
            <ul className="mt-2 space-y-1.5">
              {list.length > 0 ? (
                list.map((entry) => (
                  <li
                    key={entry}
                    className="flex items-start gap-2 text-[0.875rem] leading-snug text-muted-foreground"
                  >
                    <span className={cn('mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
                    <span>{entry}</span>
                  </li>
                ))
              ) : (
                <li className="text-[0.875rem] text-faint">{empty}</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MethodologyPanel() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.8rem] bg-fill-2 text-label-2">
          <Info className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Transparenz
          </p>
          <h2 className="font-display mt-1 text-[1.55rem] leading-tight text-label">
            Wudly trennt Besitzer-Signal und externe Orientierung.
          </h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Der Wiederkauf-Score und das Regret-Risiko kommen aus echten Wudly-Erfahrungen. Externe
            Bewertungen helfen nur bei der Einordnung und fließen nicht in das neutrale
            Besitzer-Signal ein.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <TrustChip icon={Users} label="Besitzer" text="Wie viele echte Stimmen dahinterstehen." />
        <TrustChip
          icon={ShieldCheck}
          label="Verifikation"
          text="Wie stark die Besitzerbasis belegt ist."
        />
        <TrustChip
          icon={BarChart3}
          label="Risiko"
          text="Welche Kritik und Alternativen sichtbar werden."
        />
      </div>
    </div>
  );
}

function TrustChip({ icon: Icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
  return (
    <div className="rounded-[0.9rem] bg-fill px-3 py-3">
      <p className="flex items-center gap-2 font-semibold text-label">
        <Icon className="h-4 w-4 text-accent-ink" strokeWidth={2.2} />
        {label}
      </p>
      <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 px-1">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[0.75rem] bg-accent-soft text-accent-ink">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
          {eyebrow}
        </p>
        <h2 className="font-display mt-1 text-[1.75rem] leading-tight text-label">{title}</h2>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
