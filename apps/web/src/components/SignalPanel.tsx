'use client';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { WaveLines } from '@/components/motion/WaveLines';
import { Barcode } from '@/components/receipt/Barcode';
import { LedgerRow } from '@/components/receipt/LedgerRow';
import { Stamp, verdictStamp } from '@/components/receipt/Stamp';
import { plural } from '@/lib/format';

interface SignalPanelProps {
  productId: string;
  score: number | null;
  earlySignal: boolean;
  earlyYesCount: number;
  ownerCount: number;
  experienceCount: number;
  signalStrength: string;
  /** One calm sentence of context under the stamp. */
  subline: string;
}

/**
 * The Wudly Signal as a Kassenbon — the emotional centerpiece and the brand's
 * signature artifact. A giant serif score, the verdict stamp slamming in,
 * receipt data lines with dotted leaders, a product barcode, and a perforated
 * tear-off edge. Ambient wave lines drift behind the verdict.
 */
export function SignalPanel({
  productId,
  score,
  earlySignal,
  earlyYesCount,
  ownerCount,
  experienceCount,
  signalStrength,
  subline,
}: SignalPanelProps) {
  const stamp = earlySignal
    ? ({ label: 'Frühes Signal', tone: 'unsure' } as const)
    : verdictStamp(score);

  return (
    <section
      id="signal"
      className="card perf-bottom relative scroll-mt-20 overflow-visible"
      aria-label="Wudly Signal"
    >
      <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[55%] text-accent">
          <WaveLines opacity={0.1} />
        </div>

        <div className="relative px-5 pb-4 pt-4">
          <div className="flex items-center justify-between">
            <span className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Wudly Signal
            </span>
            <span className="mono-data text-[0.6875rem] uppercase tracking-[0.14em] text-faint">
              Nr. {productId.slice(-6).toUpperCase()}
            </span>
          </div>

          {/* The verdict moment: giant serif score + stamp. */}
          <div className="mt-2 flex items-end justify-between gap-3">
            {earlySignal ? (
              <p className="font-display text-[4.4rem] leading-[0.95] text-label">
                <AnimatedNumber value={earlyYesCount} duration={0.7} />
                <span className="text-[2.4rem] text-muted-foreground">/{ownerCount}</span>
              </p>
            ) : score !== null ? (
              <p className="font-display text-[5.2rem] leading-[0.92] text-label">
                <AnimatedNumber value={score} duration={1.1} />
                <span className="text-[2.6rem]">%</span>
              </p>
            ) : (
              <p className="font-display text-[5.2rem] leading-[0.92] text-label-3">–</p>
            )}
            <div className="pb-3">
              <Stamp tone={stamp.tone}>{stamp.label}</Stamp>
            </div>
          </div>

          <p className="font-display mt-1.5 max-w-[24rem] text-[1.25rem] italic leading-snug text-ink-soft">
            {subline}
          </p>
        </div>

        <div className="rule-dashed relative mx-5" aria-hidden />

        <div className="relative space-y-2 px-5 pb-4 pt-4">
          <LedgerRow
            label="Datenbasis"
            value={`${experienceCount} ${plural(experienceCount, 'Bewertung', 'Bewertungen')}`}
          />
          <LedgerRow
            label="Besitzer"
            value={`${ownerCount} ${plural(ownerCount, 'Person', 'Personen')}`}
          />
          <LedgerRow label="Signalstärke" value={signalStrength} strong />
        </div>

        <div className="relative px-5 pb-5">
          <Barcode seed={productId} className="h-7 text-label/70" />
          <p className="mono-data mt-1.5 text-center text-[0.625rem] uppercase tracking-[0.3em] text-faint">
            Echte Besitzer · Nach Nutzung
          </p>
        </div>
      </div>
    </section>
  );
}
