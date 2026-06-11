'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useInView, useReducedMotion } from 'motion/react';
import { plural } from '@/lib/format';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { WaveLines } from '@/components/motion/WaveLines';

interface SignalPanelProps {
  score: number | null;
  earlySignal: boolean;
  earlyYesCount: number;
  ownerCount: number;
  experienceCount: number;
  signalStrength: string;
}

/**
 * The Wudly Signal hero panel — the emotional centerpiece of a product page.
 * The percentage counts up, the owner ring draws itself in, and ambient wave
 * lines drift slowly behind the verdict ("Signal" made visible).
 */
export function SignalPanel({
  score,
  earlySignal,
  earlyYesCount,
  ownerCount,
  experienceCount,
  signalStrength,
}: SignalPanelProps) {
  return (
    <section
      id="signal"
      className="panel-positive relative scroll-mt-20 overflow-hidden rounded-[1.5rem] ring-1 ring-positive/12"
    >
      <div aria-hidden className="absolute inset-0 text-positive-ink">
        <WaveLines opacity={0.14} />
      </div>

      <div className="relative flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[1.0625rem] font-bold tracking-tight text-accent-ink">
              Wudly Signal
            </h2>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-accent/12 text-[0.65rem] font-bold text-accent-ink">
              i
            </span>
          </div>
          {earlySignal ? (
            <>
              <p className="mt-2 text-[2.6rem] font-bold leading-none text-positive-ink">
                Frühes Signal
              </p>
              <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-label">
                <AnimatedNumber value={earlyYesCount} duration={0.7} className="tnum" /> von{' '}
                {ownerCount} würden es wieder kaufen
              </p>
            </>
          ) : score !== null ? (
            <>
              <p className="tnum mt-2 text-[3rem] font-bold leading-none text-positive-ink">
                <AnimatedNumber value={score} duration={1.1} />%
              </p>
              <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-label">
                würden es nach 6 Monaten
                <br />
                wieder kaufen
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[2rem] font-bold leading-none text-muted-foreground">
                Noch offen
              </p>
              <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-label">
                Noch nicht genug echte Nutzung
              </p>
            </>
          )}
        </div>
        <SignalRing score={earlySignal ? null : score} owners={ownerCount} />
      </div>

      <Link
        href="#nutzung"
        className="tap relative flex items-center gap-2 border-t border-positive/12 px-5 py-3.5"
      >
        <span className="grid h-7 w-7 place-items-center rounded-[0.6rem] bg-positive/12 text-positive-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-positive-ink">
            {signalStrength}
          </span>
          <span className="block text-[0.875rem] text-muted-foreground">
            Datenbasis: {experienceCount} {plural(experienceCount, 'Bewertung', 'Bewertungen')}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-label-3" strokeWidth={2.4} />
      </Link>
    </section>
  );
}

/* The owner ring: a gradient arc that draws itself in on first view, with the
   community glyph at its center. */
function SignalRing({ score, owners }: { score: number | null; owners: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const stroke = 9;
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const active = reduced || inView ? pct : 0;
  const dashOffset = circumference * (1 - active / 100);

  return (
    <div ref={ref} className="relative h-[6.5rem] w-[6.5rem] shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <defs>
          <linearGradient id="signal-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-positive)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--color-positive)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-positive)"
          strokeOpacity="0.14"
          strokeWidth={stroke}
        />
        {score !== null && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="url(#signal-ring-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1.2s var(--ease-ios) 0.15s' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-[4.7rem] w-[4.7rem] place-items-center rounded-full bg-surface/80 backdrop-blur-sm">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-positive-ink" fill="none" aria-hidden>
            <path
              d="M16 11a4 4 0 1 0-8 0M3 20a6 6 0 0 1 18 0"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.9" />
          </svg>
        </div>
      </div>
      <span className="sr-only">
        {score === null ? 'Noch kein Signal' : `${score}% von ${owners} Besitzern`}
      </span>
    </div>
  );
}
