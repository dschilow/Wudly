'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, MessageCircleQuestion, ThumbsUp, type LucideIcon } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

const STORAGE_KEY = 'wudly-onboarded-v1';

const POINTS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: BadgeCheck,
    title: 'Echte Besitzer, echte Nutzung',
    desc: 'Keine gekauften Bewertungen, keine Werbung im Score.',
  },
  {
    icon: ThumbsUp,
    title: 'Würdest du es wieder kaufen?',
    desc: 'Das ehrlichste Signal — statt 5-Sterne-Show.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Frag echte Besitzer',
    desc: 'Stell deine Frage — oder lass Bekannte in 10 Sekunden bewerten.',
  },
];

/**
 * First-run welcome: a one-time sheet that explains what makes the Wudly Signal
 * trustworthy, so a new visitor gets the "aha" before they start. Shows once
 * (localStorage), gently after the page settles, and respects a dismissal.
 */
export function OnboardingIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 650);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onClose={dismiss} ariaLabel="Willkommen bei Wudly">
      <div className="space-y-6 pb-2">
        <div>
          <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Willkommen bei Wudly
          </p>
          <h2 className="font-display mt-2 text-[2rem] font-semibold leading-tight text-label">
            Eine Zahl, der du <span className="text-accent-ink">trauen</span> kannst.
          </h2>
          <p className="mt-2 text-[1rem] leading-snug text-muted-foreground">
            Wudly zeigt, wie viele echte Besitzer ein Produkt nach echter Nutzung wieder kaufen
            würden.
          </p>
        </div>

        <ul className="space-y-4">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                <p.icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold text-label">{p.title}</p>
                <p className="text-[0.875rem] leading-snug text-muted-foreground">{p.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button variant="brand" size="lg" fullWidth onClick={dismiss}>
          Los geht&apos;s
        </Button>
      </div>
    </Sheet>
  );
}
