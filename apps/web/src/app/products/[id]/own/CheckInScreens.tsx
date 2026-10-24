'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, BellRing, Check } from 'lucide-react';
import {
  dueCheckInLabel,
  EXPERIENCE_MOOD_LABEL,
  ownershipAgeLabel,
  USAGE_DURATION_LABEL,
  type JourneyCheckIn,
  type OwnershipCompanionDto,
} from '@wudly/shared';
import { cn, formatDate } from '@/lib/utils';
import { productPath } from '@/lib/seo';
import { formatWeight, monthYear, untilLabel, VERDICT_STYLE } from '@/lib/companion';
import { PushOptIn } from '@/components/PushOptIn';
import { JourneyTrack } from '@/components/companion/JourneyTrack';
import { CheckInActions } from '@/components/companion/CheckInActions';
import { WeightMeter } from '@/components/companion/WeightMeter';

/*
 * Companion screens of the "Ich besitze es" flow — the returning owner's
 * check-in and the two "done" moments. A check-in leads with the verdict on
 * file so "alles wie gehabt" is one tap; the first verdict introduces the
 * journey so later reminders never come out of the blue.
 */

const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export function CheckInIntro({
  productName,
  companion,
  busy,
  error,
  onConfirm,
  onChange,
}: {
  productName: string;
  companion: OwnershipCompanionDto;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onChange: () => void;
}) {
  const { journey } = companion;
  const latest = journey.latest!;
  const verdict = VERDICT_STYLE[latest.wouldBuyAgain];
  const Icon = verdict.icon;
  const grows = journey.currentWeight !== null && journey.checkInWeight > journey.currentWeight;

  return (
    <motion.div
      className="mx-auto max-w-md space-y-5 pb-10 pt-2"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      <motion.div variants={rise} className="px-1">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {productName}
        </p>
        <p className="mono-data mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-accent-ink">
          <BellRing className="h-3 w-3" strokeWidth={2.6} aria-hidden />
          {dueCheckInLabel(journey) ?? 'Urteil aktualisieren'}
        </p>
        <h1 className="font-display mt-3 text-[1.9rem] leading-[1.08] text-label">
          Würdest du es heute noch wieder kaufen?
        </h1>
        <p className="mt-2 text-pretty text-[0.9375rem] leading-snug text-muted-foreground">
          {journey.due
            ? journey.due.purpose
            : `Du nutzt es ${ownershipAgeLabel(journey.ageDays)}. Hat sich an deinem Urteil etwas geändert?`}
        </p>
      </motion.div>

      <motion.div
        variants={rise}
        className="premium-panel relative overflow-hidden rounded-[var(--radius-2xl)] p-4 shadow-[var(--shadow-elevated)]"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-white/55">
          Dein letztes Urteil · {formatDate(latest.at)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span
            className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-[0.9rem] text-white',
              verdict.solid,
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={2.3} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[1.3rem] leading-tight text-white">{verdict.long}</p>
            <p className="mt-0.5 text-[0.8125rem] text-white/60">
              {EXPERIENCE_MOOD_LABEL[latest.experienceMood]} · Nutzung:{' '}
              {USAGE_DURATION_LABEL[latest.usageDuration]}
            </p>
          </div>
        </div>
        <JourneyTrack journey={journey} tone="dark" className="mt-5" />
      </motion.div>

      <motion.div variants={rise}>
        <CheckInActions companion={companion} busy={busy} onConfirm={onConfirm} onChange={onChange} />
      </motion.div>
      {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

      {grows && (
        <motion.div variants={rise}>
          <WeightMeter current={journey.currentWeight} next={journey.checkInWeight} />
        </motion.div>
      )}

      <motion.p variants={rise} className="px-1 text-center text-[0.8125rem] text-muted-foreground">
        Nutzt du es nicht mehr?{' '}
        <Link href="/me/products" className="font-semibold text-accent-ink">
          In deiner Begleitung beenden
        </Link>
      </motion.p>
    </motion.div>
  );
}

function DoneMark() {
  return (
    <motion.div
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-positive text-white shadow-[var(--shadow-glow)]"
    >
      <Check className="h-9 w-9" strokeWidth={3} aria-hidden />
    </motion.div>
  );
}

function VerdictStop({
  checkIn,
  caption,
  delay,
}: {
  checkIn: JourneyCheckIn;
  caption: string;
  delay: number;
}) {
  const style = VERDICT_STYLE[checkIn.wouldBuyAgain];
  const Icon = style.icon;
  return (
    <motion.div
      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 320, damping: 26 }}
    >
      <span className={cn('grid h-11 w-11 place-items-center rounded-full text-white', style.solid)}>
        <Icon className="h-5 w-5" strokeWidth={2.4} aria-hidden />
      </span>
      <span className="text-[0.9375rem] font-semibold text-label">{style.short}</span>
      <span className="text-[0.75rem] text-muted-foreground">{caption}</span>
    </motion.div>
  );
}

export function CheckInDone({
  productId,
  productName,
  before,
  after,
}: {
  productId: string;
  productName: string;
  before: JourneyCheckIn | null;
  after: OwnershipCompanionDto | null;
}) {
  const latest = after?.journey.latest ?? null;
  const changed = Boolean(before && latest && before.wouldBuyAgain !== latest.wouldBuyAgain);
  const next = after?.journey.next ?? null;

  return (
    <div className="mx-auto max-w-md px-2 pt-12 text-center">
      <DoneMark />
      <h1 className="font-display mt-5 text-[1.9rem] leading-tight text-label">
        Check-in gespeichert.
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-[1rem] leading-snug text-muted-foreground">
        {changed
          ? 'Danke für dein ehrliches Update – gerade Meinungswechsel helfen anderen Käufern enorm.'
          : 'Danke! Bestätigte Langzeit-Urteile sind das stärkste Signal auf Wudly.'}
      </p>

      {before && latest && (
        <div className="card mt-7 flex items-center gap-2 px-4 py-5">
          <VerdictStop checkIn={before} caption={formatDate(before.at)} delay={0.15} />
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="mono-data shrink-0 text-center text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <ArrowRight className="mx-auto h-5 w-5 text-label-3" strokeWidth={2.2} aria-hidden />
            {changed ? 'geändert' : 'bestätigt'}
          </motion.span>
          <VerdictStop checkIn={latest} caption="Heute" delay={0.5} />
        </div>
      )}

      {after && (
        <div className="card mt-3 p-4 text-left">
          <JourneyTrack journey={after.journey} />
          <p className="mt-3.5 text-[0.875rem] leading-snug text-muted-foreground">
            Dein Urteil zählt jetzt{' '}
            <span className="font-semibold text-label">
              {formatWeight(after.journey.currentWeight ?? 1)}
            </span>
            .{' '}
            {next
              ? `Nächster Check-in: ${next.checkLabel} – ${untilLabel(next.dueAt)} (ca. ${monthYear(next.dueAt)}).`
              : 'Alle Etappen geschafft – danke fürs Dranbleiben!'}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <Link
          href="/me/products"
          className="tap-dim flex h-[3.125rem] items-center justify-center rounded-full bg-accent text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
        >
          Zu meinen Produkten
        </Link>
        <Link
          href={productPath({ id: productId, canonicalName: productName })}
          className="tap-dim flex h-[3.125rem] items-center justify-center rounded-full bg-fill-2 text-[1.0625rem] font-semibold text-label"
        >
          Produktseite ansehen
        </Link>
      </div>
    </div>
  );
}

export function FirstVerdictDone({
  productId,
  productName,
  isPublic,
  companion,
}: {
  productId: string;
  productName: string;
  isPublic: boolean;
  companion: OwnershipCompanionDto | null;
}) {
  const next = companion?.journey.next ?? null;
  return (
    <div className="mx-auto max-w-md px-2 pt-12 text-center">
      <DoneMark />
      <h1 className="font-display mt-5 text-[1.9rem] leading-tight text-label">Urteil gefällt.</h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-[1rem] leading-snug text-muted-foreground">
        {isPublic
          ? `Deine Erfahrung mit ${productName} zählt jetzt zum Wudly Signal.`
          : `${productName} ist privat in deinem Produktprofil gespeichert.`}
      </p>

      {companion && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
          className="premium-panel relative mt-7 overflow-hidden rounded-[var(--radius-2xl)] p-4 text-left shadow-[var(--shadow-elevated)]"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/20" />
          <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[#7df2c2]">
            Wudly begleitet dich
          </p>
          <p className="font-display mt-1.5 text-[1.25rem] leading-snug text-white">
            Wir fragen später kurz nach – so wird dein Urteil zum Langzeit-Urteil.
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-white/60">
            Nach 1 Monat, 6 Monaten, einem und zwei Jahren. Ist alles wie gehabt, reicht ein Tap –
            und wiederholte Check-ins machen deinen Besitz auch ohne Rechnung glaubwürdig.
          </p>
          <JourneyTrack journey={companion.journey} tone="dark" className="mt-4" />
          {next && (
            <p className="mt-3 text-[0.8125rem] text-white/70">
              Nächster Check-in: <span className="font-semibold text-white">{next.checkLabel}</span>{' '}
              · {untilLabel(next.dueAt)}
            </p>
          )}
        </motion.div>
      )}

      <div className="mt-3 text-left">
        <PushOptIn />
      </div>

      <div className="mt-6 space-y-2.5">
        <Link
          href={productPath({ id: productId, canonicalName: productName })}
          className="tap-dim flex h-[3.125rem] items-center justify-center rounded-full bg-accent text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
        >
          Produktseite ansehen
        </Link>
        <Link
          href="/check?own=1"
          className="tap-dim flex h-[3.125rem] items-center justify-center rounded-full bg-fill-2 text-[1.0625rem] font-semibold text-label"
        >
          Noch ein eigenes Produkt hinzufügen
        </Link>
      </div>
      <Link
        href="/me/products"
        className="tap-dim mt-5 inline-block text-[0.9375rem] font-medium text-accent-ink"
      >
        Zu deinen Produkten →
      </Link>
    </div>
  );
}
