'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  BellOff,
  BellRing,
  Box,
  CalendarClock,
  ChevronRight,
  Flag,
  Plus,
  Route,
} from 'lucide-react';
import {
  CHECK_IN_MILESTONES,
  dueCheckInLabel,
  OWNERSHIP_END_REASON_LABEL,
  ownershipAgeLabel,
  type CompanionActionInput,
  type CompanionOverviewDto,
  type OwnershipCompanionDto,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn, formatDate } from '@/lib/utils';
import { capitalize, formatWeight, monthYear, untilLabel } from '@/lib/companion';
import { productPath } from '@/lib/seo';
import { PageSkeleton, EmptyState, ErrorState } from '@/components/states/States';
import { Thumb } from '@/components/Thumb';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { JourneyTrack } from '@/components/companion/JourneyTrack';
import { JourneySheet } from '@/components/companion/JourneySheet';
import { VerdictPill } from '@/components/companion/VerdictPill';
import { CheckInActions } from '@/components/companion/CheckInActions';

const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

type Filter = 'all' | 'due' | 'top' | 'regret' | 'open' | 'ended';

const FILTERS: ReadonlyArray<{
  key: Filter;
  label: string;
  match: (item: OwnershipCompanionDto) => boolean;
}> = [
  { key: 'all', label: 'Alle', match: () => true },
  { key: 'due', label: 'Fällig', match: (item) => item.journey.due !== null },
  { key: 'top', label: 'Top-Käufe', match: (item) => item.journey.latest?.wouldBuyAgain === 'YES' },
  {
    key: 'regret',
    label: 'Fehlkäufe',
    match: (item) => item.journey.latest?.wouldBuyAgain === 'NO',
  },
  { key: 'open', label: 'Ohne Urteil', match: (item) => item.journey.latest === null },
  { key: 'ended', label: 'Beendet', match: (item) => item.endedAt !== null },
];

function parseFilter(value: string | null): Filter {
  return FILTERS.some((filter) => filter.key === value) ? (value as Filter) : 'all';
}

/**
 * "Besitzen" as the owner companion: every product the user owns is a journey
 * of short check-ins (Start → 1 Monat → 6 Monate → 1 Jahr → 2 Jahre). Due
 * check-ins come first and can be answered with one tap; each card shows the
 * journey at a glance and opens the full story.
 */
export function MyProductsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user, loading } = useAuth();
  const [data, setData] = useState<CompanionOverviewDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>(() => parseFilter(searchParams.get('filter')));
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.companion.overview({ cache: 'no-store' }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/me/products');
      return;
    }
    void load();
  }, [user, loading, router, load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const dueItems = useMemo(() => items.filter((item) => item.journey.due !== null), [items]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((entry) => [entry.key, items.filter(entry.match).length]),
      ) as Record<Filter, number>,
    [items],
  );
  const activeFilter = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0]!;
  const visible = items.filter(activeFilter.match);
  const openItem = items.find((item) => item.productId === openProductId) ?? null;

  const confirm = async (item: OwnershipCompanionDto) => {
    setBusyProductId(item.productId);
    try {
      const updated = await api.companion.confirm(item.productId);
      navigator.vibrate?.(12);
      toast.show(
        `Check-in gespeichert – dein Urteil zählt jetzt ${formatWeight(updated.journey.currentWeight ?? 1)}.`,
        'success',
      );
      await load();
    } catch (error) {
      toast.show(
        error instanceof ApiError ? error.displayMessage : 'Check-in konnte nicht gespeichert werden.',
        'error',
      );
    } finally {
      setBusyProductId(null);
    }
  };

  const act = async (item: OwnershipCompanionDto, input: CompanionActionInput) => {
    setBusyProductId(item.productId);
    try {
      await api.companion.act(item.productId, input);
      toast.show(
        input.action === 'snooze'
          ? 'Alles klar – wir erinnern dich in 2 Wochen.'
          : input.action === 'mute'
            ? 'Erinnerungen für dieses Produkt pausiert.'
            : input.action === 'unmute'
              ? 'Erinnerungen sind wieder an.'
              : input.action === 'end'
                ? 'Begleitung beendet. Danke für deine Erfahrung!'
                : 'Begleitung läuft wieder.',
        'success',
      );
      await load();
    } catch (error) {
      toast.show(
        error instanceof ApiError ? error.displayMessage : 'Das hat leider nicht geklappt.',
        'error',
      );
    } finally {
      setBusyProductId(null);
    }
  };

  const chooseFilter = (next: Filter) => {
    setFilter(next);
    const url = next === 'all' ? '/me/products' : `/me/products?filter=${next}`;
    window.history.replaceState(null, '', url);
  };

  if (loading || (!data && !failed)) return <PageSkeleton />;
  if (!user) return null;

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-7 pt-2"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      <motion.section variants={rise}>
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Besitzen · Begleiter
        </p>
        <h1 className="font-display mt-2.5 text-balance text-[2.6rem] leading-[1.02] text-label sm:text-[3rem]">
          Deine Produkte, <em className="text-accent-ink">ehrlich begleitet</em>.
        </h1>
        <p className="mt-3 max-w-[34rem] text-pretty text-[1rem] leading-relaxed text-muted-foreground">
          Wudly fragt nach 1 Monat, 6 Monaten, einem und zwei Jahren kurz nach. So wird aus deinem
          ersten Eindruck ein Langzeit-Urteil, dem andere Käufer vertrauen.
        </p>
      </motion.section>

      {failed && !data ? (
        <motion.div variants={rise} className="card">
          <ErrorState
            title="Deine Produkte konnten nicht geladen werden"
            description="Bitte versuch es gleich noch einmal."
            action={
              <Button variant="gray" onClick={() => void load()}>
                Erneut versuchen
              </Button>
            }
          />
        </motion.div>
      ) : (
        data && (
          <>
            <motion.section variants={rise} className="grid grid-cols-3 gap-2.5">
              <StatTile value={data.stats.products} label="Produkte" />
              <StatTile value={data.stats.checkIns} label="Check-ins" />
              <StatTile value={data.stats.longTermCheckIns} label="Langzeit" hint="6+ Monate" />
            </motion.section>

            {dueItems.length > 0 && (
              <motion.section
                variants={rise}
                className="space-y-3"
                aria-labelledby="due-check-ins"
              >
                <div className="flex items-center gap-2 px-1">
                  <span className="relative flex h-2.5 w-2.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                  </span>
                  <h2
                    id="due-check-ins"
                    className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-accent-ink"
                  >
                    Jetzt dran · {dueItems.length}{' '}
                    {dueItems.length === 1 ? 'Check-in' : 'Check-ins'}
                  </h2>
                </div>
                <AnimatePresence initial={false} mode="popLayout">
                  {dueItems.slice(0, 3).map((item) => (
                    <DueCheckInCard
                      key={item.productId}
                      item={item}
                      busy={busyProductId === item.productId}
                      onConfirm={() => void confirm(item)}
                      onSnooze={() => void act(item, { action: 'snooze' })}
                      onOpen={() => setOpenProductId(item.productId)}
                    />
                  ))}
                </AnimatePresence>
                {dueItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => chooseFilter('due')}
                    className="tap-dim w-full text-center text-[0.875rem] font-semibold text-accent-ink"
                  >
                    Alle {dueItems.length} fälligen Check-ins anzeigen
                  </button>
                )}
              </motion.section>
            )}

            <motion.div variants={rise}>
              <Link
                href="/check?own=1"
                className="press sheen brand-gradient flex h-[3.4rem] items-center justify-center gap-2.5 rounded-full text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} />
                Produkt hinzufügen
              </Link>
            </motion.div>

            <motion.section variants={rise} className="space-y-3.5">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Meine Produkte
                </h2>
                <span className="mono-data text-[0.75rem] font-semibold text-accent-ink">
                  {items.length}
                </span>
              </div>

              {items.length > 0 && (
                <LayoutGroup id="companion-filter">
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Produkte filtern">
                    {FILTERS.filter((entry) => entry.key === 'all' || counts[entry.key] > 0).map(
                      (entry) => {
                        const active = entry.key === filter;
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => chooseFilter(entry.key)}
                            className={cn(
                              'press relative rounded-full px-3.5 py-1.5 text-[0.875rem] font-semibold transition-colors',
                              active ? 'text-primary-foreground' : 'bg-fill-2 text-label',
                            )}
                          >
                            {active && (
                              <motion.span
                                layoutId="companion-filter-pill"
                                className="absolute inset-0 rounded-full bg-primary"
                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                              />
                            )}
                            <span className="relative">
                              {entry.label}
                              <span className="ml-1.5 opacity-60">{counts[entry.key]}</span>
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </LayoutGroup>
              )}

              {items.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<Box className="h-7 w-7" strokeWidth={1.8} />}
                    title="Noch keine Produkte"
                    description="Füge hinzu, was du wirklich nutzt – Wudly begleitet dich dann mit kurzen Check-ins."
                  />
                </div>
              ) : visible.length === 0 ? (
                <p className="card px-4 py-6 text-center text-[0.9375rem] text-muted-foreground">
                  Keine Produkte in „{activeFilter.label}“.
                </p>
              ) : (
                <motion.div layout className="space-y-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {visible.map((item) => (
                      <JourneyCard
                        key={item.productId}
                        item={item}
                        onOpen={() => setOpenProductId(item.productId)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.section>

            {data.created.length > 0 && (
              <motion.section variants={rise} className="space-y-3">
                <h2 className="mono-data px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Von dir angelegt
                </h2>
                <div className="card overflow-hidden">
                  {data.created.map((product, i) => (
                    <div
                      key={product.id}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-3',
                        i < data.created.length - 1 && 'hairline',
                      )}
                    >
                      <Link href={productPath(product)} className="flex min-w-0 flex-1 items-center gap-3">
                        <Thumb product={product} className="h-11 w-11" fit="contain" />
                        <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-label">
                          {product.canonicalName}
                        </span>
                      </Link>
                      <Link
                        href={`/products/${product.id}/own`}
                        className="press shrink-0 rounded-full bg-accent-soft px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-ink"
                      >
                        Besitze ich
                      </Link>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            <motion.section variants={rise}>
              <HowItWorks />
            </motion.section>
          </>
        )
      )}

      <Sheet
        open={Boolean(openItem)}
        onClose={() => setOpenProductId(null)}
        ariaLabel={openItem ? `Begleitung für ${openItem.product.canonicalName}` : 'Begleitung'}
      >
        {openItem && (
          <JourneySheet
            item={openItem}
            busy={busyProductId === openItem.productId}
            onConfirm={() => void confirm(openItem)}
            onAct={(input) => void act(openItem, input)}
          />
        )}
      </Sheet>
    </motion.div>
  );
}

function StatTile({ value, label, hint }: { value: number; label: string; hint?: string }) {
  return (
    <div className="card px-3 py-3.5">
      <p className="font-display text-[2rem] leading-none text-label">
        <AnimatedNumber value={value} duration={0.9} />
      </p>
      <p className="mono-data mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-faint">{hint}</p>}
    </div>
  );
}

/** A due check-in on the dark verdict panel — answerable right here. */
function DueCheckInCard({
  item,
  busy,
  onConfirm,
  onSnooze,
  onOpen,
}: {
  item: OwnershipCompanionDto;
  busy: boolean;
  onConfirm: () => void;
  onSnooze: () => void;
  onOpen: () => void;
}) {
  const { journey } = item;
  const latest = journey.latest;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 90, scale: 0.96, transition: { duration: 0.28 } }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className="premium-panel relative overflow-hidden rounded-[var(--radius-2xl)] p-4 shadow-[var(--shadow-elevated)]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3.5 text-left">
        <Thumb product={item.product} className="h-14 w-14" fit="contain" rounded="rounded-[0.9rem]" />
        <span className="min-w-0 flex-1">
          <span className="mono-data block text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[#7df2c2]">
            {dueCheckInLabel(journey)}
          </span>
          <span className="mt-1 line-clamp-2 block text-[1.0625rem] font-semibold leading-tight text-white">
            {item.product.canonicalName}
          </span>
          <span className="mt-1 block text-[0.8125rem] text-white/60">
            {latest
              ? `Du nutzt es ${ownershipAgeLabel(journey.ageDays)}.`
              : `Als Besitz markiert – dein Urteil fehlt noch.`}
          </span>
        </span>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35" strokeWidth={2.3} aria-hidden />
      </button>

      <JourneyTrack journey={journey} tone="dark" className="mt-4" />

      {latest && (
        <p className="mt-3.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-white/65">
          Zuletzt am {formatDate(latest.at)}:
          <VerdictPill verdict={latest.wouldBuyAgain} onDark />
        </p>
      )}

      <CheckInActions
        companion={item}
        tone="dark"
        busy={busy}
        onConfirm={onConfirm}
        className="mt-4"
      />
      <button
        type="button"
        onClick={onSnooze}
        disabled={busy}
        className="tap-dim mx-auto mt-2.5 block text-[0.8125rem] font-medium text-white/50"
      >
        Später erinnern
      </button>
    </motion.article>
  );
}

/** One owned product: verdict, time of use and the journey at a glance. */
function JourneyCard({ item, onOpen }: { item: OwnershipCompanionDto; onOpen: () => void }) {
  const { journey } = item;
  const checkIns = journey.checkIns.length;
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: item.endedAt ? 0.72 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      className="card press block w-full p-3.5 text-left"
    >
      <span className="flex items-start gap-3">
        <Thumb product={item.product} className="h-[3.6rem] w-[3.6rem]" fit="contain" rounded="rounded-[0.9rem]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-[1rem] font-semibold leading-tight text-label">
              {item.product.canonicalName}
            </span>
            {journey.latest ? (
              <VerdictPill verdict={journey.latest.wouldBuyAgain} />
            ) : (
              <span className="shrink-0 rounded-full bg-fill-2 px-2.5 py-1 text-[0.75rem] font-semibold text-muted-foreground">
                Ohne Urteil
              </span>
            )}
          </span>
          <span className="mt-1 block text-[0.8125rem] text-muted-foreground">
            {item.endedAt
              ? `Genutzt bis ${monthYear(item.endedAt)}`
              : capitalize(`${ownershipAgeLabel(journey.ageDays)} bei dir`)}
            {checkIns > 0 && ` · ${checkIns} ${checkIns === 1 ? 'Check-in' : 'Check-ins'}`}
          </span>
        </span>
      </span>

      <JourneyTrack journey={journey} className="mt-3.5" />

      <span className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-[0.8125rem]">
        <StatusLine item={item} />
      </span>
    </motion.button>
  );
}

function StatusLine({ item }: { item: OwnershipCompanionDto }) {
  const { journey } = item;
  if (item.endedAt) {
    return (
      <>
        <Flag className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.4} aria-hidden />
        <span className="text-muted-foreground">
          Beendet{item.endReason ? `: ${OWNERSHIP_END_REASON_LABEL[item.endReason]}` : ''}
        </span>
      </>
    );
  }
  if (journey.due) {
    return (
      <>
        <BellRing className="h-3.5 w-3.5 text-accent-ink" strokeWidth={2.4} aria-hidden />
        <span className="font-semibold text-accent-ink">{dueCheckInLabel(journey)} fällig</span>
      </>
    );
  }
  if (item.muted) {
    return (
      <>
        <BellOff className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.4} aria-hidden />
        <span className="text-muted-foreground">Erinnerungen pausiert</span>
      </>
    );
  }
  if (journey.next) {
    return (
      <>
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.4} aria-hidden />
        <span className="text-muted-foreground">
          Nächster Check-in: <span className="font-semibold text-label">{journey.next.label}</span>{' '}
          · {untilLabel(journey.next.dueAt)}
        </span>
      </>
    );
  }
  return (
    <>
      <Flag className="h-3.5 w-3.5 text-positive-ink" strokeWidth={2.4} aria-hidden />
      <span className="font-semibold text-positive-ink">Alle Etappen geschafft</span>
    </>
  );
}

/** The companion explained once, calmly: the five stages and why they matter. */
function HowItWorks() {
  return (
    <details className="card group overflow-hidden">
      <summary className="tap flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.75rem] bg-accent-soft text-accent-ink">
          <Route className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-label">
            So funktioniert die Begleitung
          </span>
          <span className="block text-[0.8125rem] text-muted-foreground">
            Fünf kurze Etappen statt einer einzigen Bewertung.
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-label-3 transition-transform group-open:rotate-90"
          strokeWidth={2.3}
          aria-hidden
        />
      </summary>
      <ol className="space-y-3 border-t border-border px-4 pb-4 pt-3.5">
        {CHECK_IN_MILESTONES.map((milestone, i) => (
          <li key={milestone.key} className="flex gap-3">
            <span className="mono-data grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill-2 text-[0.6875rem] font-bold text-label">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.875rem] font-semibold text-label">
                {milestone.label} · {milestone.title}
              </span>
              <span className="block text-[0.8125rem] leading-snug text-muted-foreground">
                {milestone.purpose}
              </span>
            </span>
          </li>
        ))}
        <li className="rounded-[var(--radius-md)] bg-fill px-3 py-2.5 text-[0.8125rem] leading-snug text-muted-foreground">
          Ist alles wie gehabt, reicht ein Tap. Längere Nutzung gibt deinem Urteil mehr Gewicht
          (bis 1,5×) – Erinnerungen kommen nur tagsüber und lassen sich pro Produkt pausieren.
        </li>
      </ol>
    </details>
  );
}
