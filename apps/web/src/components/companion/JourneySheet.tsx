'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BellOff,
  BellRing,
  CalendarClock,
  ExternalLink,
  Flag,
  PackageX,
  RotateCcw,
  TimerReset,
} from 'lucide-react';
import {
  dueCheckInLabel,
  EXPERIENCE_MOOD_LABEL,
  OWNERSHIP_END_REASON_LABEL,
  OWNERSHIP_END_REASON_OPTIONS,
  ownershipAgeLabel,
  USAGE_DURATION_LABEL,
  type CompanionActionInput,
  type JourneyMilestone,
  type OwnershipCompanionDto,
  type OwnershipEndReason,
} from '@wudly/shared';
import { cn, formatDate } from '@/lib/utils';
import { productPath } from '@/lib/seo';
import {
  capitalize,
  MILESTONE_STATE_LABEL,
  monthYear,
  untilLabel,
  VERDICT_STYLE,
} from '@/lib/companion';
import { Thumb } from '@/components/Thumb';
import { JourneyTrack } from './JourneyTrack';
import { VerdictPill } from './VerdictPill';
import { WeightMeter } from './WeightMeter';
import { CheckInActions } from './CheckInActions';

/**
 * Everything about one owned product's journey: where the owner stands, what is
 * due, every check-in so far (with verdict changes called out), and the owner's
 * controls — remind later, pause, or close the journey ("Nutze ich nicht mehr").
 */
export function JourneySheet({
  item,
  busy,
  onConfirm,
  onAct,
}: {
  item: OwnershipCompanionDto;
  busy: boolean;
  onConfirm: () => void;
  onAct: (input: CompanionActionInput) => void;
}) {
  const { journey } = item;
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState<OwnershipEndReason | null>(null);
  const label = dueCheckInLabel(journey);

  return (
    <div className="space-y-6 pb-2">
      <header className="flex items-start gap-3.5 pr-10">
        <Thumb product={item.product} className="h-16 w-16" fit="contain" rounded="rounded-[1rem]" />
        <div className="min-w-0 flex-1">
          <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Deine Begleitung
          </p>
          <h2 className="mt-1 line-clamp-2 text-[1.1875rem] font-semibold leading-tight text-label">
            {item.product.canonicalName}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {capitalize(ownershipAgeLabel(journey.ageDays))} bei dir
            {item.variantName ? ` · ${item.variantName}` : ''} · auf Wudly seit{' '}
            {formatDate(item.createdAt)}
          </p>
        </div>
      </header>

      <div className="card p-4">
        <JourneyTrack journey={journey} size="md" showDates />
      </div>

      {/* What to do now. */}
      {item.endedAt ? (
        <div className="rounded-[var(--radius-lg)] bg-fill p-4">
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-label">
            <Flag className="h-4 w-4 text-muted-foreground" strokeWidth={2.3} aria-hidden />
            Begleitung beendet
            {item.endReason ? `: ${OWNERSHIP_END_REASON_LABEL[item.endReason]}` : ''}
          </p>
          <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
            Am {formatDate(item.endedAt)}. Dein Urteil bleibt sichtbar und du kannst es jederzeit
            noch anpassen.
          </p>
          <button
            type="button"
            onClick={() => onAct({ action: 'reactivate' })}
            disabled={busy}
            className="tap-dim mt-3 flex items-center gap-1.5 text-[0.875rem] font-semibold text-accent-ink"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.4} aria-hidden />
            Ich nutze es doch wieder
          </button>
        </div>
      ) : journey.due ? (
        <div className="rounded-[var(--radius-lg)] bg-accent-soft p-4 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]">
          <p className="mono-data flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent-ink">
            <BellRing className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            Jetzt dran · {label}
          </p>
          <p className="font-display mt-2 text-[1.35rem] leading-tight text-label">
            {journey.latest ? 'Würdest du es heute wieder kaufen?' : 'Würdest du es wieder kaufen?'}
          </p>
          <p className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
            {journey.due.purpose}
          </p>
          <CheckInActions companion={item} busy={busy} onConfirm={onConfirm} className="mt-4" />
          <button
            type="button"
            onClick={() => onAct({ action: 'snooze' })}
            disabled={busy}
            className="tap-dim mx-auto mt-3 flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground"
          >
            <TimerReset className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            In 2 Wochen erinnern
          </button>
        </div>
      ) : journey.next ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-fill p-4">
          <CalendarClock
            className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink"
            strokeWidth={2.2}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold text-label">
              Nächster Check-in: {journey.next.checkLabel}
            </p>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
              {item.muted
                ? 'Erinnerungen sind pausiert – schau gern selbst vorbei.'
                : `Wir melden uns ${untilLabel(journey.next.dueAt)} (ca. ${monthYear(journey.next.dueAt)}).`}{' '}
              Hat sich vorher etwas geändert?
            </p>
            <Link
              href={`/products/${item.productId}/own`}
              className="tap-dim mt-2 inline-flex items-center gap-1 text-[0.875rem] font-semibold text-accent-ink"
            >
              Urteil jetzt aktualisieren
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-positive-soft p-4">
          <Flag className="mt-0.5 h-5 w-5 shrink-0 text-positive-ink" strokeWidth={2.2} aria-hidden />
          <p className="text-[0.9375rem] leading-snug text-label">
            <span className="font-semibold">Alle Etappen geschafft.</span> Dein Langzeit-Urteil ist
            das stärkste Signal, das Wudly hat – danke!
          </p>
        </div>
      )}

      <WeightMeter
        current={journey.currentWeight}
        next={journey.due && !item.endedAt ? journey.checkInWeight : null}
      />

      <section>
        <h3 className="mono-data px-1 pb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Deine Etappen
        </h3>
        <ol className="relative">
          <span
            aria-hidden
            className="absolute bottom-4 left-[0.875rem] top-4 w-[2px] -translate-x-1/2 rounded-full bg-separator"
          />
          {journey.milestones.map((milestone, i) => (
            <MilestoneRow
              key={milestone.key}
              milestone={milestone}
              index={i}
              previous={previousVerdict(journey.milestones, i)}
            />
          ))}
        </ol>
      </section>

      {/* Owner controls. */}
      {!item.endedAt && (
        <section className="card overflow-hidden">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct({ action: item.muted ? 'unmute' : 'mute' })}
            className="tap hairline flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            {item.muted ? (
              <BellRing className="h-5 w-5 text-accent-ink" strokeWidth={2.2} aria-hidden />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" strokeWidth={2.2} aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-label">
                {item.muted ? 'Erinnerungen wieder einschalten' : 'Erinnerungen pausieren'}
              </span>
              <span className="block text-[0.8125rem] text-muted-foreground">
                {item.muted
                  ? 'Wudly meldet sich wieder zu den nächsten Etappen.'
                  : 'Keine Check-in-Nachrichten mehr für dieses Produkt.'}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setEnding((value) => !value)}
            aria-expanded={ending}
            className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <PackageX className="h-5 w-5 text-muted-foreground" strokeWidth={2.2} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-label">
                Nutze ich nicht mehr
              </span>
              <span className="block text-[0.8125rem] text-muted-foreground">
                Kaputt, verkauft, ersetzt? Beendet die Begleitung.
              </span>
            </span>
          </button>
          <AnimatePresence initial={false}>
            {ending && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                  <p className="text-[0.8125rem] text-muted-foreground">Was ist passiert?</p>
                  <div className="flex flex-wrap gap-2">
                    {OWNERSHIP_END_REASON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={reason === option.value}
                        onClick={() => setReason(option.value)}
                        className={cn(
                          'press rounded-full px-3.5 py-2 text-[0.875rem] font-medium',
                          reason === option.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-fill-2 text-label',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {reason === 'BROKEN' && journey.latest?.wouldBuyAgain === 'YES' && (
                    <p className="text-[0.8125rem] leading-snug text-muted-foreground">
                      Tipp: Passe danach dein Urteil an – ein Defekt ist für andere Käufer die
                      wichtigste Information.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!reason || busy}
                    onClick={() => reason && onAct({ action: 'end', reason })}
                    className="press flex h-11 w-full items-center justify-center rounded-full bg-primary text-[0.9375rem] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Begleitung beenden
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <Link
        href={productPath(item.product)}
        className="press flex h-12 items-center justify-center gap-2 rounded-full bg-fill-2 text-[0.9375rem] font-semibold text-label"
      >
        <ExternalLink className="h-4 w-4" strokeWidth={2.3} aria-hidden />
        Produktseite öffnen
      </Link>
    </div>
  );
}

/** The verdict of the closest earlier finished stage, to call out changes. */
function previousVerdict(milestones: JourneyMilestone[], index: number) {
  for (let i = index - 1; i >= 0; i--) {
    const checkIn = milestones[i]!.checkIn;
    if (checkIn) return checkIn.wouldBuyAgain;
  }
  return null;
}

function MilestoneRow({
  milestone,
  index,
  previous,
}: {
  milestone: JourneyMilestone;
  index: number;
  previous: ReturnType<typeof previousVerdict>;
}) {
  const reduced = useReducedMotion();
  const checkIn = milestone.checkIn;
  const changed = checkIn && previous && previous !== checkIn.wouldBuyAgain;
  const dim = milestone.state === 'before' || milestone.state === 'closed';

  return (
    <motion.li
      className={cn('relative flex gap-3.5 pb-5 last:pb-0', dim && 'opacity-55')}
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: dim ? 0.55 : 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.06, type: 'spring', stiffness: 320, damping: 30 }}
    >
      <span className="relative z-[1] grid h-7 w-7 shrink-0 place-items-center">
        <MilestoneDot milestone={milestone} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[0.9375rem] font-semibold leading-tight text-label">
            {milestone.label}
            <span className="font-normal text-muted-foreground"> · {milestone.title}</span>
          </p>
          {milestone.state === 'due' && (
            <span className="mono-data rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-white">
              fällig
            </span>
          )}
        </div>

        {checkIn ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <VerdictPill verdict={checkIn.wouldBuyAgain} />
            <span className="text-[0.8125rem] text-muted-foreground">
              {EXPERIENCE_MOOD_LABEL[checkIn.experienceMood]} ·{' '}
              {USAGE_DURATION_LABEL[checkIn.usageDuration]} · {formatDate(checkIn.at)}
            </span>
            {changed && (
              <span
                className={cn(
                  'mono-data rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em]',
                  VERDICT_STYLE[checkIn.wouldBuyAgain].soft,
                  VERDICT_STYLE[checkIn.wouldBuyAgain].ink,
                )}
              >
                Urteil geändert: {VERDICT_STYLE[previous].short} → {VERDICT_STYLE[checkIn.wouldBuyAgain].short}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            {milestone.state === 'upcoming'
              ? `ca. ${monthYear(milestone.dueAt)} · ${untilLabel(milestone.dueAt)}`
              : milestone.state === 'due'
                ? milestone.purpose
                : capitalize(MILESTONE_STATE_LABEL[milestone.state])}
          </p>
        )}
      </div>
    </motion.li>
  );
}

function MilestoneDot({ milestone }: { milestone: JourneyMilestone }) {
  if (milestone.checkIn) {
    const style = VERDICT_STYLE[milestone.checkIn.wouldBuyAgain];
    const Icon = style.icon;
    return (
      <span className={cn('grid h-7 w-7 place-items-center rounded-full text-white', style.solid)}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.7} aria-hidden />
      </span>
    );
  }
  if (milestone.state === 'due') {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white shadow-[var(--shadow-glow)]">
        <BellRing className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'block h-3.5 w-3.5 rounded-full border-2 bg-canvas',
        milestone.state === 'upcoming' ? 'border-border-strong' : 'border-dashed border-label-4',
      )}
    />
  );
}
