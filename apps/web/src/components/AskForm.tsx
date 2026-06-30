'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Users } from 'lucide-react';
import { COMMON_QUESTIONS, type ProductPromptDto } from '@wudly/shared';
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

  // The stored product-specific pool — served instantly from the DB (no AI wait).
  // Owners answered these in the wizard, so each carries an answer count.
  const [prompts, setPrompts] = useState<ProductPromptDto[]>([]);

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

  // Fall back to curated questions only when the product has no pool at all.
  const fallback = prompts.length === 0;
  const suggestions: Array<{ text: string; responseCount: number }> = fallback
    ? COMMON_QUESTIONS.map((text) => ({ text, responseCount: 0 }))
    : prompts.map((p) => ({ text: p.questionText, responseCount: p.responseCount }));

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
          {fallback ? (
            'Häufige Fragen'
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
              Vorgeschlagene Fragen
            </>
          )}
        </p>
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[0_0_0_1px_var(--color-border)]">
          {suggestions.slice(0, 5).map((q, i) => (
            <button
              key={q.text}
              onClick={() => {
                navigator.vibrate?.(5);
                setText(q.text);
              }}
              className={
                'tap flex w-full items-center gap-3 px-4 py-3 text-left ' +
                (i < Math.min(suggestions.length, 5) - 1 ? 'hairline' : '')
              }
              style={{ ['--hairline-inset' as string]: '1rem' }}
            >
              <span className="flex-1 text-[1rem] text-label">{q.text}</span>
              {q.responseCount > 0 && (
                <span className="mono-data flex shrink-0 items-center gap-1 rounded-full bg-positive-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-positive-ink">
                  <Users className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                  {q.responseCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {!fallback && (
          <p className="px-1 pt-1.5 text-[0.8125rem] leading-snug text-muted-foreground">
            Tippe eine Frage an — viele haben Besitzer schon beantwortet.
          </p>
        )}
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
