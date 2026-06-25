'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import type {
  CategoryAspectDto,
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
} from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  USAGE_DURATION_OPTIONS,
  EXPERIENCE_MOOD_OPTIONS,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { OptionGrid, MultiSelectChips } from '@/components/OptionGrid';

interface FlowProps {
  productId: string;
  productName: string;
  aspects: CategoryAspectDto[];
}

const TOTAL_STEPS = 4;

/** Everything captured in the wizard — persisted so a sign-in detour never loses it. */
interface ExperienceDraft {
  buyAgain: WouldBuyAgain;
  duration: UsageDuration;
  mood: ExperienceMood;
  wish: string;
  insteadOf: string;
  positives: string[];
  negatives: string[];
  isPublic: boolean;
}

const draftKey = (productId: string) => `wudly:own-draft:${productId}`;

export function OwnExperienceFlow({ productId, productName, aspects }: FlowProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  /** +1 when moving forward, -1 backward — drives the slide direction. */
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True while auto-saving a draft that survived a sign-in detour. */
  const [resuming, setResuming] = useState(false);

  const [buyAgain, setBuyAgain] = useState<WouldBuyAgain | null>(null);
  const [duration, setDuration] = useState<UsageDuration | null>(null);
  const [mood, setMood] = useState<ExperienceMood | null>(null);
  const [wish, setWish] = useState('');
  const [insteadOf, setInsteadOf] = useState('');
  const [positives, setPositives] = useState<string[]>([]);
  const [negatives, setNegatives] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  const positiveAspects = aspects.filter((a) => a.type !== 'NEGATIVE');
  const negativeAspects = aspects.filter((a) => a.type !== 'POSITIVE');

  /**
   * Selecting a neutral aspect (e.g. "Update-Politik") on one side clears it on
   * the other — the same dimension can please or annoy, but never both at once.
   */
  const togglePositive = (key: string) => {
    setNegatives((n) => n.filter((k) => k !== key));
    setPositives((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };
  const toggleNegative = (key: string) => {
    setPositives((p) => p.filter((k) => k !== key));
    setNegatives((n) => (n.includes(key) ? n.filter((k) => k !== key) : [...n, key]));
  };

  const canNext =
    (step === 1 && buyAgain) || (step === 2 && duration) || (step === 3 && mood) || step === 4;

  /** Persist the experience. Pulls from an explicit draft so the resume path
   *  (after sign-in) never races React state that hasn't rehydrated yet. */
  const submitDraft = async (draft: ExperienceDraft) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.experiences.create(productId, {
        wouldBuyAgain: draft.buyAgain,
        usageDuration: draft.duration,
        experienceMood: draft.mood,
        wishKnownText: draft.wish.trim() || undefined,
        insteadOfText: draft.insteadOf.trim() || undefined,
        positiveAspects: draft.positives.length ? draft.positives : undefined,
        negativeAspects: draft.negatives.length ? draft.negatives : undefined,
        isPublic: draft.isPublic,
      });
      try {
        sessionStorage.removeItem(draftKey(productId));
      } catch {
        /* private mode — nothing to clean up */
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.');
      return false;
    } finally {
      setSubmitting(false);
    }
    return true;
  };

  const submit = async () => {
    if (!buyAgain || !duration || !mood) return;
    const draft: ExperienceDraft = {
      buyAgain,
      duration,
      mood,
      wish,
      insteadOf,
      positives,
      negatives,
      isPublic,
    };
    // No cold signup wall: the rating is already done. Keep the answers and ask
    // to sign in only now, then auto-save on return.
    if (!user) {
      try {
        sessionStorage.setItem(draftKey(productId), JSON.stringify(draft));
      } catch {
        /* private mode — fall through to the auth detour anyway */
      }
      router.push(`/login?redirect=${encodeURIComponent(`/products/${productId}/own`)}`);
      return;
    }
    await submitDraft(draft);
  };

  /* ----- Resume: a draft survived the sign-in detour → save it automatically. */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !user || resumedRef.current || done) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(draftKey(productId));
    } catch {
      raw = null;
    }
    if (!raw) return;
    resumedRef.current = true;
    let draft: ExperienceDraft | null = null;
    try {
      draft = JSON.parse(raw) as ExperienceDraft;
    } catch {
      draft = null;
    }
    if (!draft?.buyAgain || !draft.duration || !draft.mood) {
      try {
        sessionStorage.removeItem(draftKey(productId));
      } catch {
        /* ignore */
      }
      return;
    }
    setResuming(true);
    void submitDraft(draft).finally(() => setResuming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, done, productId]);

  /* ----- Resuming: saving a draft after sign-in ----- */
  if (resuming && !done) {
    return (
      <div className="mx-auto max-w-md px-2 pt-24 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" strokeWidth={2.2} aria-hidden />
        <p className="mt-4 text-[1.0625rem] text-muted-foreground">Deine Bewertung wird gespeichert …</p>
      </div>
    );
  }

  /* ----- Thank you ----- */
  if (done) {
    return (
      <div className="mx-auto max-w-md px-2 pt-16 text-center">
        <div className="animate-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-positive text-white">
          <Check className="h-9 w-9" strokeWidth={3} aria-hidden />
        </div>
        <h1 className="mt-5 text-[1.75rem] font-bold text-label">Danke!</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-[1.0625rem] leading-snug text-muted-foreground">
          Deine Erfahrung mit {productName} zählt jetzt zum Wudly Signal — und in dein Kaufprofil.
        </p>
        <div className="mt-8 space-y-2.5">
          <Link
            href={`/products/${productId}`}
            className="tap-dim flex h-[3.125rem] items-center justify-center rounded-[var(--radius-md)] bg-accent text-[1.0625rem] font-semibold text-white"
          >
            Produktseite ansehen
          </Link>
          <Link
            href="/check?own=1"
            className="tap-dim flex h-[3.125rem] items-center justify-center rounded-[var(--radius-md)] bg-fill-2 text-[1.0625rem] font-semibold text-label"
          >
            Weiteres Produkt bewerten
          </Link>
        </div>
        <Link
          href="/me"
          className="tap-dim mt-5 inline-block text-[0.9375rem] font-medium text-accent"
        >
          Dein Kaufprofil ansehen →
        </Link>
      </div>
    );
  }

  /* ----- Steps ----- */
  const titles = [
    'Würdest du es wieder kaufen?',
    'Wie lange nutzt du es?',
    'Was trifft am besten zu?',
    'Was hättest du gern vorher gewusst?',
  ];

  return (
    <div className="mx-auto max-w-md pb-28 pt-2">
      {/* Progress — thin iOS segments */}
      <div className="mb-6 flex items-center gap-1.5 px-1">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-fill-2" aria-hidden>
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 ease-[var(--ease-ios)]"
              style={{ width: i < step ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <motion.div
        key={step}
        custom={dir}
        variants={{
          enter: (d: number) => ({ x: d * 42, opacity: 0 }),
          center: { x: 0, opacity: 1 },
          exit: (d: number) => ({ x: d * -42, opacity: 0 }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
        className="space-y-5"
      >
        <div className="px-1">
          <p className="text-[0.8125rem] text-faint">
            Schritt {step} von {TOTAL_STEPS}
            {step === 4 && ' · optional'}
          </p>
          <h1 className="mt-1 text-[1.6875rem] font-bold leading-tight tracking-tight text-label">
            {titles[step - 1]}
          </h1>
        </div>

        {step === 1 && (
          <OptionGrid options={WOULD_BUY_AGAIN_OPTIONS} value={buyAgain} onChange={setBuyAgain} />
        )}
        {step === 2 && (
          <OptionGrid options={USAGE_DURATION_OPTIONS} value={duration} onChange={setDuration} />
        )}
        {step === 3 && (
          <OptionGrid options={EXPERIENCE_MOOD_OPTIONS} value={mood} onChange={setMood} />
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
                Was hättest du gern vorher gewusst?
              </label>
              <textarea
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                rows={3}
                placeholder="z. B. Dass die Station ziemlich groß ist…"
                className="w-full rounded-[var(--radius-lg)] bg-surface p-3.5 text-[1.0625rem] text-label outline-none placeholder:text-faint"
              />
            </div>

            <div>
              <label className="mb-1.5 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
                Hättest du lieber etwas anderes gekauft?
              </label>
              <input
                type="text"
                value={insteadOf}
                onChange={(e) => setInsteadOf(e.target.value)}
                maxLength={160}
                placeholder="z. B. Roborock S8 — sonst leer lassen"
                className="w-full rounded-[var(--radius-lg)] bg-surface p-3.5 text-[1.0625rem] text-label outline-none placeholder:text-faint"
              />
            </div>

            {positiveAspects.length > 0 && (
              <div>
                <label className="mb-2 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
                  Was gefällt dir?
                </label>
                <MultiSelectChips
                  options={positiveAspects}
                  selected={positives}
                  onToggle={togglePositive}
                  tone="positive"
                />
              </div>
            )}

            {negativeAspects.length > 0 && (
              <div>
                <label className="mb-2 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
                  Was nervt?
                </label>
                <MultiSelectChips
                  options={negativeAspects}
                  selected={negatives}
                  onToggle={toggleNegative}
                  tone="negative"
                />
              </div>
            )}

            {/* iOS toggle switch */}
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className="flex w-full items-center justify-between rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-left"
            >
              <span className="text-[1.0625rem] text-label">Öffentlich teilen</span>
              <span
                className={cn(
                  'relative h-[1.575rem] w-[2.75rem] shrink-0 rounded-full transition-colors duration-200',
                  isPublic ? 'bg-positive' : 'bg-faint/50',
                )}
              >
                <span
                  className={cn(
                    'absolute top-[0.125rem] h-[1.325rem] w-[1.325rem] rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-ios)]',
                    isPublic ? 'translate-x-[1.3rem]' : 'translate-x-[0.125rem]',
                  )}
                />
              </span>
            </button>
          </div>
        )}

        {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}
      </motion.div>
      </AnimatePresence>

      {/* Fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-[4.6rem] z-30 px-5 pb-[max(env(safe-area-inset-bottom),0px)] md:bottom-4">
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          {step > 1 && (
            <Button
              variant="gray"
              onClick={() => {
                setDir(-1);
                setStep((s) => s - 1);
              }}
              size="lg"
              className="rounded-full bg-surface/95 shadow-[0_0_0_1px_var(--color-border-strong),var(--shadow-card)] backdrop-blur-xl"
            >
              Zurück
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => {
                setDir(1);
                navigator.vibrate?.(6);
                setStep((s) => s + 1);
              }}
              disabled={!canNext}
              size="lg"
              className="flex-1 rounded-full shadow-[var(--shadow-glow)]"
            >
              Weiter
            </Button>
          ) : (
            <Button
              onClick={submit}
              loading={submitting}
              size="lg"
              className="flex-1 rounded-full shadow-[var(--shadow-glow)]"
            >
              Abschicken
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
