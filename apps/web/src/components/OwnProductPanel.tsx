'use client';

import Link from 'next/link';
import { BadgeCheck, BellRing, PenLine } from 'lucide-react';
import { dueCheckInLabel, ownershipAgeLabel } from '@wudly/shared';
import { useViewerCompanion } from '@/lib/use-viewer-companion';
import { capitalize, untilLabel } from '@/lib/companion';
import { JourneyTrack } from '@/components/companion/JourneyTrack';
import { VerdictPill } from '@/components/companion/VerdictPill';

/**
 * The desktop sidebar's "next step" card. Owners see their own companion — the
 * journey, what is due and when the next check-in comes — so nobody who already
 * rated the product is asked to declare ownership a second time.
 */
export function OwnProductPanel({ productId }: { productId: string }) {
  const companion = useViewerCompanion(productId);

  if (!companion) {
    return (
      <div className="card p-4">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
          Nächster Schritt
        </p>
        <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
          Die beste Hilfe für andere Käufer ist eine echte Langzeiterfahrung zu diesem Produkt.
        </p>
        <Link
          href={`/products/${productId}/own`}
          className="press mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[0.9375rem] font-semibold text-white shadow-[var(--shadow-glow)]"
        >
          <BadgeCheck className="h-4 w-4" strokeWidth={2.3} />
          Ich besitze es
        </Link>
      </div>
    );
  }

  const { journey } = companion;
  const due = dueCheckInLabel(journey);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
          Deine Begleitung
        </p>
        {journey.latest && <VerdictPill verdict={journey.latest.wouldBuyAgain} />}
      </div>
      <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
        {capitalize(ownershipAgeLabel(journey.ageDays))} bei dir
      </p>
      <JourneyTrack journey={journey} className="mt-3.5" />
      <p className="mt-3 text-[0.875rem] leading-snug text-muted-foreground">
        {companion.endedAt
          ? 'Begleitung beendet – dein Urteil bleibt änderbar.'
          : due
            ? `${due} ist fällig.`
            : journey.next
              ? `Nächster Check-in ${untilLabel(journey.next.dueAt)}.`
              : 'Alle Etappen geschafft.'}
      </p>
      <Link
        href={`/products/${productId}/own`}
        className="press mt-3.5 flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[0.9375rem] font-semibold text-white shadow-[var(--shadow-glow)]"
      >
        {due ? (
          <>
            <BellRing className="h-4 w-4" strokeWidth={2.3} />
            {journey.latest ? 'Check-in machen' : 'Urteil abgeben'}
          </>
        ) : (
          <>
            <PenLine className="h-4 w-4" strokeWidth={2.3} />
            Urteil aktualisieren
          </>
        )}
      </Link>
      <Link
        href="/me/products"
        className="tap-dim mt-2.5 block text-center text-[0.8125rem] font-semibold text-accent-ink"
      >
        Alle meine Produkte
      </Link>
    </div>
  );
}
