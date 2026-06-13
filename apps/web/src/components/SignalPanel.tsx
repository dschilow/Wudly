'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { WaveLines } from '@/components/motion/WaveLines';
import { Barcode } from '@/components/receipt/Barcode';
import { LedgerRow } from '@/components/receipt/LedgerRow';
import { Stamp, verdictStamp } from '@/components/receipt/Stamp';
import { Sheet } from '@/components/ui/Sheet';
import { plural } from '@/lib/format';

interface SignalPanelProps {
  productId: string;
  productName: string;
  score: number | null;
  earlySignal: boolean;
  earlyYesCount: number;
  ownerCount: number;
  experienceCount: number;
  signalStrength: string;
  /** One calm sentence of context under the stamp. */
  subline: string;
}

const STAMP_TONE_TEXT = {
  positive: 'text-[#7fd6a4]',
  regret: 'text-[#f0a795]',
  unsure: 'text-[#e3bc76]',
  neutral: 'text-[#a4a193]',
} as const;

/**
 * The Wudly Signal as a Kassenbon — plus its "Dynamic Island": once the bon
 * scrolls out of view, the verdict condenses into a dark capsule that drops in
 * under the header. Tapping it morphs the capsule open into a mini receipt
 * (spring layout animation); "Zum Signal" floats you back to the bon.
 */
export function SignalPanel({
  productId,
  productName,
  score,
  earlySignal,
  earlyYesCount,
  ownerCount,
  experienceCount,
  signalStrength,
  subline,
}: SignalPanelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [passed, setPassed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // The island appears only after the bon has scrolled up past the header.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const above = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setPassed(above);
        if (!above) setExpanded(false);
      },
      { rootMargin: '-64px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stamp = earlySignal
    ? ({ label: 'Im Aufbau', tone: 'unsure' } as const)
    : verdictStamp(score);

  const scoreText = earlySignal ? 'Aufbau' : score !== null ? `${score}%` : '–';

  return (
    <>
      <section
        ref={sectionRef}
        id="signal"
        className="card perf-bottom relative scroll-mt-20 overflow-visible"
        aria-label="Wudly Signal"
      >
        <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[55%] text-accent">
            <WaveLines opacity={0.1} />
          </div>

          <div className="relative px-5 pb-4 pt-4">
            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(5);
                setInfoOpen(true);
              }}
              className="tap-dim flex w-full items-center justify-between"
              aria-label="Was ist das Wudly Signal?"
            >
              <span className="mono-data flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Wudly Signal
                <span className="grid h-4 w-4 place-items-center rounded-full bg-fill-2 text-[0.625rem] font-bold normal-case text-muted-foreground">
                  i
                </span>
              </span>
              <span className="mono-data text-[0.6875rem] uppercase tracking-[0.14em] text-faint">
                Nr. {productId.slice(-6).toUpperCase()}
              </span>
            </button>

            {/* The verdict moment: giant serif score + stamp. */}
            <div className="mt-2 flex items-end justify-between gap-3">
              {earlySignal ? (
                <p className="font-display text-[3.45rem] leading-[0.95] text-label sm:text-[4rem]">
                  Aufbau
                  <span className="block pt-1 text-[1rem] leading-snug text-muted-foreground">
                    {earlyYesCount} von {ownerCount} Besitzern sagen ja
                  </span>
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

      {/* ── The Signal Island ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {passed && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 top-[3.1rem] z-40 flex justify-center px-5"
            initial={reduced ? { opacity: 0 } : { y: -64, opacity: 0, scale: 0.8 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { y: -64, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <motion.button
              type="button"
              layout
              onClick={() => {
                navigator.vibrate?.(8);
                setExpanded((v) => !v);
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="pointer-events-auto overflow-hidden rounded-[1.5rem] bg-[#1a1a16] text-[#f1efe6] shadow-[0_14px_40px_-10px_rgba(0,0,0,0.55)]"
              style={{ width: expanded ? 'min(100%, 22rem)' : 'auto' }}
              aria-expanded={expanded}
              aria-label={`Wudly Signal ${scoreText} — ${stamp.label}`}
            >
              <motion.div layout="position" className="flex items-center gap-2.5 px-4 py-2">
                <span className="font-display text-[1.45rem] leading-none">{scoreText}</span>
                <span
                  className={`mono-data text-[0.625rem] font-bold uppercase tracking-[0.18em] ${STAMP_TONE_TEXT[stamp.tone]}`}
                >
                  {stamp.label}
                </span>
                <span className="relative ml-auto flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7fd6a4] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7fd6a4]" />
                </span>
              </motion.div>

              {expanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="px-4 pb-3.5 text-left"
                >
                  <p className="border-t border-dashed border-[#f1efe630] pt-2.5 text-[0.8125rem] leading-snug text-[#f1efe6cc]">
                    {productName}
                  </p>
                  <div className="mono-data mt-2 space-y-1 text-[0.6875rem] uppercase tracking-[0.1em] text-[#f1efe699]">
                    <p className="flex justify-between gap-4">
                      <span>Datenbasis</span>
                      <span className="text-[#f1efe6]">{experienceCount} Bew.</span>
                    </p>
                    <p className="flex justify-between gap-4">
                      <span>Signalstärke</span>
                      <span className="text-[#f1efe6]">{signalStrength}</span>
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(false);
                      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        setExpanded(false);
                        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="mono-data mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f1efe61a] px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-[#f1efe6]"
                  >
                    ↑ Zum Signal
                  </span>
                </motion.div>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── "Was ist das Wudly Signal?" sheet ────────────────────────────── */}
      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} ariaLabel="Was ist das Wudly Signal?">
        <div className="space-y-5 pb-2">
          <div>
            <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Wudly Signal
            </p>
            <h2 className="font-display mt-2 text-[2rem] leading-tight text-label">
              Eine Zahl, der du <em className="text-accent-ink">trauen</em> kannst.
            </h2>
            <p className="mt-3 text-[1rem] leading-snug text-muted-foreground">
              Das Signal zählt nur eines: Wie viele echte Besitzer würden das Produkt nach echter
              Nutzung <span className="font-semibold text-label">wieder kaufen</span>. Keine Sterne,
              keine gekauften Bewertungen, keine Werbung im Score.
            </p>
          </div>

          <div className="card space-y-2.5 p-4">
            <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Signalstärke
            </p>
            <LedgerRow label="Signalstatus" value="Signal im Aufbau" />
            <LedgerRow label="Ab 20" value="Erste Tendenz" />
            <LedgerRow label="Ab 80" value="Belastbare Tendenz" />
            <LedgerRow label="Ab 250" value="Starkes Langzeitsignal" strong />
          </div>

          <p className="px-1 text-[0.875rem] leading-snug text-muted-foreground">
            Bewertungen externer Plattformen zeigen wir transparent daneben — sie fließen{' '}
            <span className="font-medium text-label">nie</span> in das Signal ein.
          </p>
        </div>
      </Sheet>
    </>
  );
}
