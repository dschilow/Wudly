'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Button } from '@/components/ui/Button';
import { OptionGrid, MultiSelectChips } from '@/components/OptionGrid';
import { AuthGate } from '@/components/AuthGate';

interface FlowProps {
  productId: string;
  productName: string;
  aspects: CategoryAspectDto[];
}

const TOTAL_STEPS = 4;

export function OwnExperienceFlow({ productId, productName, aspects }: FlowProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buyAgain, setBuyAgain] = useState<WouldBuyAgain | null>(null);
  const [duration, setDuration] = useState<UsageDuration | null>(null);
  const [mood, setMood] = useState<ExperienceMood | null>(null);
  const [wish, setWish] = useState('');
  const [positives, setPositives] = useState<string[]>([]);
  const [negatives, setNegatives] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  const positiveAspects = aspects.filter((a) => a.type !== 'NEGATIVE');
  const negativeAspects = aspects.filter((a) => a.type !== 'POSITIVE');

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const canNext = (step === 1 && buyAgain) || (step === 2 && duration) || (step === 3 && mood) || step === 4;

  const submit = async () => {
    if (!buyAgain || !duration || !mood) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.experiences.create(productId, {
        wouldBuyAgain: buyAgain,
        usageDuration: duration,
        experienceMood: mood,
        wishKnownText: wish.trim() || undefined,
        positiveAspects: positives.length ? positives : undefined,
        negativeAspects: negatives.length ? negatives : undefined,
        isPublic,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ----- Auth gate ----- */
  if (!authLoading && !user) {
    return (
      <AuthGate
        title="Kurz anmelden"
        description="Damit deine Erfahrung dir zugeordnet werden kann, brauchst du ein kostenloses Konto."
        redirect={`/products/${productId}/own`}
      />
    );
  }

  /* ----- Thank you ----- */
  if (done) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <div className="animate-pop text-6xl" aria-hidden>
          🎉
        </div>
        <h1 className="mt-4 text-2xl font-black text-ink">Danke!</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground">
          Deine Erfahrung hilft anderen, bessere Kaufentscheidungen zu treffen.
        </p>
        <div className="mt-7 grid gap-3">
          <Link
            href={`/products/${productId}`}
            className="flex h-12 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground"
          >
            Produktseite ansehen
          </Link>
          <Link
            href="/check"
            className="flex h-12 items-center justify-center rounded-2xl bg-surface text-sm font-bold text-ink ring-1 ring-border"
          >
            Weiteres Produkt bewerten
          </Link>
        </div>
      </div>
    );
  }

  /* ----- Steps ----- */
  return (
    <div className="mx-auto max-w-md">
      {/* Progress */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span className="truncate pr-2">{productName}</span>
          <span>
            Schritt {step}/{TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div key={step} className="animate-rise space-y-5">
        {step === 1 && (
          <>
            <h1 className="text-2xl font-extrabold text-ink">Würdest du es wieder kaufen?</h1>
            <OptionGrid options={WOULD_BUY_AGAIN_OPTIONS} value={buyAgain} onChange={setBuyAgain} />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-extrabold text-ink">Wie lange nutzt du es?</h1>
            <OptionGrid options={USAGE_DURATION_OPTIONS} value={duration} onChange={setDuration} />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-extrabold text-ink">
              Was beschreibt deine Erfahrung am besten?
            </h1>
            <OptionGrid options={EXPERIENCE_MOOD_OPTIONS} value={mood} onChange={setMood} />
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-2xl font-extrabold text-ink">Noch etwas? (optional)</h1>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">
                  Was hättest du gerne vor dem Kauf gewusst?
                </label>
                <textarea
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  rows={3}
                  placeholder="z. B. Dass die Station ziemlich groß ist…"
                  className="w-full rounded-2xl border border-border-strong bg-surface p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                />
              </div>

              {positiveAspects.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-positive-ink">
                    Was gefällt dir?
                  </label>
                  <MultiSelectChips
                    options={positiveAspects}
                    selected={positives}
                    onToggle={(k) => toggle(positives, setPositives, k)}
                    tone="positive"
                  />
                </div>
              )}

              {negativeAspects.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-regret-ink">
                    Was nervt?
                  </label>
                  <MultiSelectChips
                    options={negativeAspects}
                    selected={negatives}
                    onToggle={(k) => toggle(negatives, setNegatives, k)}
                    tone="negative"
                  />
                </div>
              )}

              <label className="flex items-center gap-3 rounded-2xl bg-surface-sunken p-3 text-sm">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-5 w-5 accent-[color:var(--color-accent)]"
                />
                <span className="text-ink">
                  Öffentlich teilen{' '}
                  <span className="text-muted-foreground">(hilft anderen Käufern)</span>
                </span>
              </label>
            </div>
          </>
        )}

        {error && <p className="text-sm font-medium text-regret-ink">{error}</p>}

        {/* Nav */}
        <div className="flex gap-3 pt-1">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="flex-1">
              Zurück
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              fullWidth={step === 1}
              className={step > 1 ? 'flex-1' : ''}
            >
              Weiter
            </Button>
          ) : (
            <Button onClick={submit} loading={submitting} className="flex-1">
              Erfahrung abschicken
            </Button>
          )}
        </div>

        {step === TOTAL_STEPS && (
          <button
            onClick={submit}
            disabled={submitting}
            className="mx-auto block text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            Ohne Extras abschicken
          </button>
        )}
      </div>
    </div>
  );
}
