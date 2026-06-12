'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { COMMON_QUESTIONS } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

/**
 * The "Besitzer fragen" composer — textarea + AI-suggested questions. Lives in
 * the product page's bottom sheet (and on the standalone /ask route).
 */
export function AskForm({
  productId,
  productName,
  onDone,
}: {
  productId: string;
  productName: string;
  /** Called after the question was posted (e.g. close the sheet). */
  onDone?: () => void;
}) {
  const { user, loading } = useAuth();
  const { show } = useToast();

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI-suggested questions (falls back to the curated list while loading / on error).
  const [suggestions, setSuggestions] = useState<string[]>([...COMMON_QUESTIONS]);
  const [aiSuggested, setAiSuggested] = useState(false);

  useEffect(() => {
    let active = true;
    api.products
      .questionSuggestions(productId, { cache: 'no-store' })
      .then((res) => {
        if (active && res.questions.length > 0) {
          setSuggestions(res.questions);
          setAiSuggested(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [productId]);

  const submit = async () => {
    if (text.trim().length < 5) {
      setError('Deine Frage ist etwas zu kurz.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.questions.create(productId, { questionText: text.trim() });
      navigator.vibrate?.(12);
      show('Frage gestellt 🙌', 'success');
      setText('');
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Frage konnte nicht gesendet werden.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="font-display text-[1.5rem] italic leading-snug text-label">
          Frag echte Besitzer.
        </p>
        <p className="mx-auto max-w-xs text-[0.9375rem] leading-snug text-muted-foreground">
          Melde dich an, um Besitzern von „{productName}&ldquo; eine Frage zu stellen.
        </p>
        <Link
          href={`/login?redirect=/products/${productId}`}
          className="press inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-[1rem] font-semibold text-[#f1efe6]"
        >
          Anmelden
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Besitzer fragen
        </p>
        <h2 className="font-display mt-1.5 text-[1.6rem] leading-tight text-label">
          {productName}
        </h2>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Was möchtest du von echten Besitzern wissen?"
        className="w-full rounded-[var(--radius-lg)] bg-surface p-4 text-[1.0625rem] leading-snug text-label shadow-[0_0_0_1px_var(--color-border)] outline-none placeholder:text-faint focus:shadow-[0_0_0_2px_var(--color-accent)]"
      />

      <div>
        <p className="mono-data flex items-center gap-1.5 px-1 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {aiSuggested ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
              Vorgeschlagene Fragen
            </>
          ) : (
            'Häufige Fragen'
          )}
        </p>
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          {suggestions.slice(0, 4).map((q, i) => (
            <button
              key={q}
              onClick={() => {
                navigator.vibrate?.(5);
                setText(q);
              }}
              className={
                'tap flex w-full items-center px-4 py-3 text-left text-[1rem] text-label ' +
                (i < Math.min(suggestions.length, 4) - 1 ? 'hairline' : '')
              }
              style={{ ['--hairline-inset' as string]: '1rem' }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

      <Button
        fullWidth
        size="lg"
        loading={submitting}
        onClick={submit}
        className="rounded-full shadow-[var(--shadow-glow)]"
      >
        Frage abschicken
      </Button>
    </div>
  );
}
