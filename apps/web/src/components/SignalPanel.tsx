'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { LedgerRow } from '@/components/receipt/LedgerRow';
import { verdictStamp } from '@/components/receipt/Stamp';
import { Sheet } from '@/components/ui/Sheet';

interface SignalPanelProps {
  productId: string;
  productName: string;
  score: number | null;
  earlySignal: boolean;
  earlyYesCount: number;
  ownerCount: number;
  experienceCount: number;
  signalStrength: string;
  /** One calm sentence of context under the verdict. */
  subline: string;
}

/** Fixed tone colors that read on the always-dark verdict panel (mode-proof). */
const TONE_COLOR = {
  positive: '#37d98d',
  regret: '#f76c5e',
  unsure: '#efb44a',
  neutral: '#9b9fae',
} as const;

function StatRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <span className="text-[0.9rem] text-white/55">{label}</span>
      <span
        className="font-mono text-[0.9rem] tabular-nums"
        style={{ color: strong ? '#34e39b' : '#eef0f5' }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The Wudly Signal as a "Verdict" — a single, premium dark panel that stays dark
 * in both color schemes so the score always pops. A giant Space Grotesk numeral
 * with a living colored glow behind it, a clean verdict tag, and tidy data rows.
 * Plus its "Signal Island": once the panel scrolls out of view the verdict
 * condenses into a floating capsule that drops in under the header; tapping it
 * morphs open into a mini summary (spring layout animation).
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

  // The island appears only after the panel has scrolled up past the header.
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
    ? ({ label: 'Zu wenige Daten', tone: 'unsure' } as const)
    : verdictStamp(score);
  const toneColor = TONE_COLOR[stamp.tone];
  const scoreText = earlySignal ? 'Offen' : score !== null ? `${score}%` : '–';

  return (
    <>
      <section
        ref={sectionRef}
        id="signal"
        className="premium-panel relative scroll-mt-20 overflow-hidden rounded-[var(--radius-xl)] shadow-elevated ring-1 ring-white/10"
        aria-label="Wudly Signal"
      >
        {/* Living glow — a slow luminous breath in the verdict's color. */}
        <span
          aria-hidden
          className="animate-verdict-pulse pointer-events-none absolute -left-10 top-10 h-48 w-48 rounded-full blur-3xl"
          style={{ background: toneColor, opacity: 0.4 }}
        />

        <div className="relative px-6 pb-6 pt-5">
          {/* Overline: label + info, and a live signal pulse. */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(5);
                setInfoOpen(true);
              }}
              className="tap-dim flex items-center gap-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-white/55"
              aria-label="Was ist das Wudly Signal?"
            >
              Wudly Signal
              <span className="grid h-4 w-4 place-items-center rounded-full bg-white/10 text-[0.625rem] font-bold normal-case text-white/70">
                i
              </span>
            </button>
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                style={{ background: '#34e39b' }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ background: '#34e39b' }}
              />
            </span>
          </div>

          {/* The verdict moment. */}
          <div className="mt-3 flex items-end justify-between gap-4">
            {earlySignal ? (
              <p className="font-display text-[2.7rem] font-semibold leading-[1.0] tracking-[-0.03em] text-white sm:text-[3rem]">
                Noch offen
                <span className="block pt-1.5 text-[0.95rem] font-normal leading-snug text-white/60">
                  Erst {earlyYesCount} von {ownerCount} Besitzern würden wieder kaufen — zu wenige
                  für ein klares Urteil.
                </span>
              </p>
            ) : score !== null ? (
              <p className="font-display text-[5rem] font-semibold leading-[0.88] tracking-[-0.04em] text-white">
                <AnimatedNumber value={score} duration={1.1} />
                <span className="text-[2.4rem]">%</span>
              </p>
            ) : (
              <p className="font-display text-[5rem] font-semibold leading-[0.88] text-white/25">–</p>
            )}
            <div className="pb-3">
              <span
                className="animate-stamp inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em]"
                style={{ borderColor: 'rgba(255,255,255,0.18)', color: toneColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneColor }} />
                {stamp.label}
              </span>
            </div>
          </div>

          <p className="mt-3 max-w-[26rem] text-[1.05rem] leading-snug text-white/70">{subline}</p>

          {/* Clean data rows — no dotted leaders, no barcode. */}
          <div className="mt-5 divide-y divide-white/[0.07] rounded-[var(--radius-md)] bg-white/[0.03]">
            <StatRow label="Bewertungen" value={`${experienceCount}`} />
            <StatRow label="Besitzer" value={`${ownerCount}`} />
            <StatRow label="Aussagekraft" value={signalStrength} strong />
          </div>

          <p className="mt-4 text-center font-mono text-[0.625rem] uppercase tracking-[0.3em] text-white/40">
            Echte Besitzer · Nach Nutzung
          </p>
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
              className="pointer-events-auto overflow-hidden rounded-[1.5rem] bg-[#15161d] text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
              style={{ width: expanded ? 'min(100%, 22rem)' : 'auto' }}
              aria-expanded={expanded}
              aria-label={`Wudly Signal ${scoreText} — ${stamp.label}`}
            >
              <motion.div layout="position" className="flex items-center gap-2.5 px-4 py-2">
                <span className="font-display text-[1.45rem] font-semibold leading-none">
                  {scoreText}
                </span>
                <span
                  className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.18em]"
                  style={{ color: toneColor }}
                >
                  {stamp.label}
                </span>
                <span className="relative ml-auto flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                    style={{ background: '#34e39b' }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ background: '#34e39b' }}
                  />
                </span>
              </motion.div>

              {expanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="px-4 pb-3.5 text-left"
                >
                  <p className="border-t border-white/15 pt-2.5 text-[0.8125rem] leading-snug text-white/80">
                    {productName}
                  </p>
                  <div className="mt-2 space-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-white/60">
                    <p className="flex justify-between gap-4">
                      <span>Datenbasis</span>
                      <span className="text-white">{experienceCount} Bew.</span>
                    </p>
                    <p className="flex justify-between gap-4">
                      <span>Aussagekraft</span>
                      <span className="text-white">{signalStrength}</span>
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
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-white"
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
            <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Wudly Signal
            </p>
            <h2 className="font-display mt-2 text-[2rem] font-semibold leading-tight text-label">
              Eine Zahl, der du <span className="text-accent-ink">trauen</span> kannst.
            </h2>
            <p className="mt-3 text-[1rem] leading-snug text-muted-foreground">
              Das Signal zählt nur eines: Wie viele echte Besitzer würden das Produkt nach echter
              Nutzung <span className="font-semibold text-label">wieder kaufen</span>. Keine Sterne,
              keine gekauften Bewertungen, keine Werbung im Score.
            </p>
          </div>

          <div className="card space-y-2.5 p-4">
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Aussagekraft
            </p>
            <LedgerRow label="Unter 20 Bewertungen" value="Zu wenige Daten" />
            <LedgerRow label="Ab 20" value="Erste Tendenz" />
            <LedgerRow label="Ab 80" value="Solide Datenbasis" />
            <LedgerRow label="Ab 250" value="Sehr große Datenbasis" strong />
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
