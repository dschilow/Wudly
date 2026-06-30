'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2, Plus, SkipForward } from 'lucide-react';
import type {
  CategoryAspectDto,
  ProductPromptDto,
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

/** One owner answer to a product prompt (a tapped quick answer or own text). */
interface PromptAnswer {
  answerLabel: string;
  isCustom: boolean;
}

/** Everything captured in the wizard — persisted so a sign-in detour never loses it. */
interface ExperienceDraft {
  buyAgain: WouldBuyAgain;
  duration: UsageDuration;
  mood: ExperienceMood;
  wish: string;
  insteadOf: string;
  positives: string[];
  negatives: string[];
  customAspects: string[];
  promptAnswers: Record<string, PromptAnswer>;
  isPublic: boolean;
}

/** A wizard card. Prompt cards carry the prompt id (`prompt:<id>`). */
type StepKey = 'buyAgain' | 'duration' | 'mood' | 'aspects' | 'wish' | 'share' | `prompt:${string}`;

const draftKey = (productId: string) => `wudly:own-draft:${productId}`;

export function OwnExperienceFlow({ productId, productName, aspects }: FlowProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
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
  const [customAspects, setCustomAspects] = useState<string[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, PromptAnswer>>({});
  const [isPublic, setIsPublic] = useState(true);

  /** Product-specific question pool — loaded async, never blocks the core cards. */
  const [prompts, setPrompts] = useState<ProductPromptDto[]>([]);

  const positiveAspects = aspects.filter((a) => a.type !== 'NEGATIVE');
  const negativeAspects = aspects.filter((a) => a.type !== 'POSITIVE');

  /**
   * Selecting a neutral aspect on one side clears it on the other — the same
   * dimension can please or annoy, but never both at once.
   */
  const togglePositive = (key: string) => {
    setNegatives((n) => n.filter((k) => k !== key));
    setPositives((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };
  const toggleNegative = (key: string) => {
    setPositives((p) => p.filter((k) => k !== key));
    setNegatives((n) => (n.includes(key) ? n.filter((k) => k !== key) : [...n, key]));
  };

  /* ----- Load the product-specific prompt pool (non-blocking). ----- */
  useEffect(() => {
    let active = true;
    api.products
      .prompts(productId, { cache: 'no-store' })
      .then((res) => {
        if (active) setPrompts(res);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [productId]);

  /**
   * The adaptive card order. Core verdict first, then likes/dislikes, then the
   * product-specific prompts, then the optional wrap-up. The pool slots in once
   * loaded — always before the core cards are exhausted, so the index is stable.
   */
  const hasAspects = positiveAspects.length > 0 || negativeAspects.length > 0;
  const steps = useMemo<StepKey[]>(() => {
    const s: StepKey[] = ['buyAgain', 'duration', 'mood'];
    if (hasAspects) s.push('aspects');
    for (const p of prompts) s.push(`prompt:${p.id}`);
    s.push('wish', 'share');
    return s;
  }, [hasAspects, prompts]);

  const total = steps.length;
  const current = steps[Math.min(step, total - 1)]!;
  const promptById = useMemo(() => new Map(prompts.map((p) => [p.id, p])), [prompts]);

  const goNext = useCallback(() => {
    navigator.vibrate?.(6);
    setDir(1);
    setStep((s) => Math.min(s + 1, total - 1));
  }, [total]);

  const goBack = useCallback(() => {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  /** Single-choice cards confirm with a short pop, then advance themselves. */
  const advanceSoon = useCallback(() => {
    navigator.vibrate?.(8);
    window.setTimeout(() => {
      setDir(1);
      setStep((s) => Math.min(s + 1, total - 1));
    }, 240);
  }, [total]);

  const answerPrompt = useCallback(
    (promptId: string, answer: PromptAnswer | null) => {
      setPromptAnswers((prev) => {
        if (!answer) {
          const next = { ...prev };
          delete next[promptId];
          return next;
        }
        return { ...prev, [promptId]: answer };
      });
      advanceSoon();
    },
    [advanceSoon],
  );

  /** Persist the experience. Pulls from an explicit draft so the resume path
   *  (after sign-in) never races React state that hasn't rehydrated yet. */
  const submitDraft = useCallback(
    async (draft: ExperienceDraft) => {
      setSubmitting(true);
      setError(null);
      try {
        const promptResponses = Object.entries(draft.promptAnswers).map(([promptId, a]) => ({
          promptId,
          answerLabel: a.answerLabel,
          isCustom: a.isCustom,
        }));
        await api.experiences.create(productId, {
          wouldBuyAgain: draft.buyAgain,
          usageDuration: draft.duration,
          experienceMood: draft.mood,
          wishKnownText: draft.wish.trim() || undefined,
          insteadOfText: draft.insteadOf.trim() || undefined,
          positiveAspects: [...draft.positives, ...draft.customAspects].length
            ? [...draft.positives, ...draft.customAspects]
            : undefined,
          negativeAspects: draft.negatives.length ? draft.negatives : undefined,
          promptResponses: promptResponses.length ? promptResponses : undefined,
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
    },
    [productId],
  );

  const buildDraft = useCallback(
    (): ExperienceDraft | null =>
      buyAgain && duration && mood
        ? {
            buyAgain,
            duration,
            mood,
            wish,
            insteadOf,
            positives,
            negatives,
            customAspects,
            promptAnswers,
            isPublic,
          }
        : null,
    [buyAgain, duration, mood, wish, insteadOf, positives, negatives, customAspects, promptAnswers, isPublic],
  );

  const submit = async () => {
    const draft = buildDraft();
    if (!draft) return;
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
        <p className="mt-4 text-[1.0625rem] text-muted-foreground">Dein Urteil wird gespeichert …</p>
      </div>
    );
  }

  /* ----- The verdict is in ----- */
  if (done) {
    return (
      <div className="mx-auto max-w-md px-2 pt-16 text-center">
        <div className="animate-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-positive text-white shadow-[var(--shadow-glow)]">
          <Check className="h-9 w-9" strokeWidth={3} aria-hidden />
        </div>
        <h1 className="font-display mt-5 text-[1.9rem] leading-tight text-label">Urteil gefällt.</h1>
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
        <Link href="/me" className="tap-dim mt-5 inline-block text-[0.9375rem] font-medium text-accent">
          Dein Kaufprofil ansehen →
        </Link>
      </div>
    );
  }

  /* ----- Per-card heading + body ----- */
  const isPromptStep = current.startsWith('prompt:');
  const activePrompt = isPromptStep ? promptById.get(current.slice('prompt:'.length)) : undefined;

  // The likes/dislikes card adapts to the verdict: a "No" leads with what annoys.
  const leadNegative = buyAgain === 'NO';

  const heading =
    current === 'buyAgain'
      ? 'Würdest du es wieder kaufen?'
      : current === 'duration'
        ? 'Wie lange nutzt du es?'
        : current === 'mood'
          ? 'Was trifft am besten zu?'
          : current === 'aspects'
            ? leadNegative
              ? 'Was stört am meisten?'
              : 'Was überzeugt dich?'
            : current === 'wish'
              ? 'Was hättest du gern vorher gewusst?'
              : current === 'share'
                ? 'Dein Urteil teilen?'
                : (activePrompt?.questionText ?? '');

  const optional = current === 'wish' || isPromptStep;

  return (
    <div className="mx-auto max-w-md pb-28 pt-2">
      {/* Progress — thin verdict segments, dynamic to the adaptive path */}
      <div className="mb-6 flex items-center gap-1.5 px-1" aria-hidden>
        {steps.map((key, i) => (
          <div key={key} className="h-1 flex-1 overflow-hidden rounded-full bg-fill-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 ease-[var(--ease-ios)]"
              style={{ width: i <= step ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={current}
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
              {productName}
              {optional && ' · optional'}
            </p>
            <h1 className="font-display mt-1 text-[1.75rem] leading-tight text-label">{heading}</h1>
          </div>

          {current === 'buyAgain' && (
            <OptionGrid
              options={WOULD_BUY_AGAIN_OPTIONS}
              value={buyAgain}
              onChange={(v) => {
                setBuyAgain(v);
                advanceSoon();
              }}
            />
          )}
          {current === 'duration' && (
            <OptionGrid
              options={USAGE_DURATION_OPTIONS}
              value={duration}
              onChange={(v) => {
                setDuration(v);
                advanceSoon();
              }}
            />
          )}
          {current === 'mood' && (
            <OptionGrid
              options={EXPERIENCE_MOOD_OPTIONS}
              value={mood}
              onChange={(v) => {
                setMood(v);
                advanceSoon();
              }}
            />
          )}

          {current === 'aspects' && (
            <AspectsCard
              first={leadNegative ? 'negative' : 'positive'}
              positiveAspects={positiveAspects}
              negativeAspects={negativeAspects}
              positives={positives}
              negatives={negatives}
              customAspects={customAspects}
              onTogglePositive={togglePositive}
              onToggleNegative={toggleNegative}
              onAddCustom={(label) => setCustomAspects((c) => [...c, label])}
              onRemoveCustom={(label) => setCustomAspects((c) => c.filter((x) => x !== label))}
            />
          )}

          {isPromptStep && activePrompt && (
            <PromptCard
              key={activePrompt.id}
              prompt={activePrompt}
              value={promptAnswers[activePrompt.id]}
              onPick={(answer) => answerPrompt(activePrompt.id, answer)}
              onSkip={goNext}
            />
          )}

          {current === 'wish' && (
            <div className="space-y-5">
              <textarea
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                rows={3}
                placeholder="z. B. Dass die Station ziemlich groß ist…"
                className="w-full rounded-[var(--radius-lg)] bg-surface p-3.5 text-[1.0625rem] text-label outline-none placeholder:text-faint shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)]"
              />
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
                  className="w-full rounded-[var(--radius-lg)] bg-surface p-3.5 text-[1.0625rem] text-label outline-none placeholder:text-faint shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)]"
                />
              </div>
            </div>
          )}

          {current === 'share' && (
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className="flex w-full items-center justify-between rounded-[var(--radius-lg)] bg-surface px-4 py-3.5 text-left shadow-[0_0_0_1px_var(--color-border)]"
            >
              <span className="min-w-0 pr-3">
                <span className="block text-[1.0625rem] text-label">Öffentlich teilen</span>
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground">
                  {isPublic
                    ? 'Deine Erfahrung hilft anderen Käufern sichtbar.'
                    : 'Zählt zum Signal, bleibt aber anonym.'}
                </span>
              </span>
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
          )}

          {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}
        </motion.div>
      </AnimatePresence>

      {/* Fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-[4.6rem] z-30 px-5 pb-[max(env(safe-area-inset-bottom),0px)] md:bottom-4">
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          {step > 0 && (
            <Button
              variant="gray"
              onClick={goBack}
              size="lg"
              className="rounded-full bg-surface/95 shadow-[0_0_0_1px_var(--color-border-strong),var(--shadow-card)] backdrop-blur-xl"
            >
              Zurück
            </Button>
          )}
          {current === 'share' ? (
            <Button
              onClick={submit}
              loading={submitting}
              size="lg"
              className="flex-1 rounded-full shadow-[var(--shadow-glow)]"
            >
              Urteil abschicken
            </Button>
          ) : isPromptStep ? (
            <Button
              variant="gray"
              onClick={goNext}
              size="lg"
              className="flex-1 rounded-full bg-surface/95 shadow-[0_0_0_1px_var(--color-border-strong),var(--shadow-card)] backdrop-blur-xl"
            >
              <SkipForward className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.3} aria-hidden />
              Überspringen
            </Button>
          ) : current === 'aspects' || current === 'wish' ? (
            <Button
              onClick={goNext}
              size="lg"
              className="flex-1 rounded-full shadow-[var(--shadow-glow)]"
            >
              Weiter
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Prompt card — a product-specific question with tap-to-answer quick
 * answers and an "own answer" escape hatch. Auto-advances on pick.
 * ------------------------------------------------------------------ */

function PromptCard({
  prompt,
  value,
  onPick,
  onSkip,
}: {
  prompt: ProductPromptDto;
  value: PromptAnswer | undefined;
  onPick: (answer: PromptAnswer) => void;
  onSkip: () => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const submitCustom = () => {
    const label = customText.trim();
    if (label.length < 1) return;
    onPick({ answerLabel: label, isCustom: true });
  };

  return (
    <div className="space-y-3">
      {prompt.quickAnswers.length > 0 && (
        <div className="card overflow-hidden">
          {prompt.quickAnswers.map((answer, i) => {
            const selected = value && !value.isCustom && value.answerLabel === answer;
            return (
              <button
                key={answer}
                type="button"
                onClick={() => onPick({ answerLabel: answer, isCustom: false })}
                className={cn(
                  'tap flex w-full items-center gap-3 px-4 py-3.5 text-left',
                  i < prompt.quickAnswers.length - 1 && 'hairline',
                )}
                style={{ ['--hairline-inset' as string]: '1rem' }}
              >
                <span className="flex-1 text-[1.0625rem] text-label">{answer}</span>
                {selected && (
                  <Check className="h-[1.25rem] w-[1.25rem] text-accent" strokeWidth={3} aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}

      {customOpen || prompt.quickAnswers.length === 0 ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCustom();
            }}
            maxLength={120}
            placeholder="Deine eigene Antwort…"
            className="h-12 min-w-0 flex-1 rounded-[var(--radius-lg)] bg-surface px-4 text-[1.0625rem] text-label outline-none placeholder:text-faint shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)]"
          />
          <Button onClick={submitCustom} disabled={customText.trim().length < 1} className="shrink-0 rounded-full">
            <Check className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.6} aria-hidden />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCustomText(value?.isCustom ? value.answerLabel : '');
            setCustomOpen(true);
          }}
          className="tap-dim flex items-center gap-2 px-1 text-[0.9375rem] font-medium text-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden />
          Eigene Antwort
        </button>
      )}

      {value?.isCustom && !customOpen && (
        <p className="flex items-center gap-1.5 px-1 text-[0.875rem] text-positive-ink">
          <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
          {value.answerLabel}
        </p>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="tap-dim block px-1 text-[0.8125rem] text-faint"
      >
        Diese Frage überspringen
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Likes / dislikes card — category aspects as chips plus a free-text
 * "own point" the owner can add to either side.
 * ------------------------------------------------------------------ */

function AspectsCard({
  first,
  positiveAspects,
  negativeAspects,
  positives,
  negatives,
  customAspects,
  onTogglePositive,
  onToggleNegative,
  onAddCustom,
  onRemoveCustom,
}: {
  first: 'positive' | 'negative';
  positiveAspects: CategoryAspectDto[];
  negativeAspects: CategoryAspectDto[];
  positives: string[];
  negatives: string[];
  customAspects: string[];
  onTogglePositive: (key: string) => void;
  onToggleNegative: (key: string) => void;
  onAddCustom: (label: string) => void;
  onRemoveCustom: (label: string) => void;
}) {
  const [customText, setCustomText] = useState('');
  const addCustom = () => {
    const label = customText.trim();
    if (label.length < 2 || customAspects.includes(label)) return;
    onAddCustom(label);
    setCustomText('');
  };

  const positiveBlock = positiveAspects.length > 0 && (
    <div>
      <label className="mb-2 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
        Was gefällt dir?
      </label>
      <MultiSelectChips
        options={positiveAspects}
        selected={positives}
        onToggle={onTogglePositive}
        tone="positive"
      />
    </div>
  );
  const negativeBlock = negativeAspects.length > 0 && (
    <div>
      <label className="mb-2 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
        Was nervt?
      </label>
      <MultiSelectChips
        options={negativeAspects}
        selected={negatives}
        onToggle={onToggleNegative}
        tone="negative"
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {first === 'negative' ? (
        <>
          {negativeBlock}
          {positiveBlock}
        </>
      ) : (
        <>
          {positiveBlock}
          {negativeBlock}
        </>
      )}

      <div>
        <label className="mb-2 block px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
          Eigener Punkt
        </label>
        {customAspects.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {customAspects.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onRemoveCustom(label)}
                className="tap-dim flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2 text-[0.9375rem] font-medium text-accent-ink"
              >
                {label}
                <Plus className="h-3.5 w-3.5 rotate-45" strokeWidth={2.6} aria-hidden />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustom();
            }}
            maxLength={80}
            placeholder="Etwas anderes? Hier eintippen…"
            className="h-12 min-w-0 flex-1 rounded-[var(--radius-lg)] bg-surface px-4 text-[1.0625rem] text-label outline-none placeholder:text-faint shadow-[0_0_0_1px_var(--color-border)] focus:shadow-[0_0_0_2px_var(--color-accent)]"
          />
          <Button
            variant="gray"
            onClick={addCustom}
            disabled={customText.trim().length < 2}
            className="shrink-0 rounded-full"
          >
            <Plus className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.6} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
