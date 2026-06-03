'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { COMMON_QUESTIONS } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { AuthGate } from '@/components/AuthGate';

export function AskClient({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
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
      show('Frage gestellt 🙌', 'success');
      router.push(`/products/${productId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Frage konnte nicht gesendet werden.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !user) {
    return (
      <AuthGate
        title="Frage an Besitzer"
        description={`Melde dich an, um Besitzern von „${productName}" eine Frage zu stellen.`}
        redirect={`/products/${productId}/ask`}
      />
    );
  }

  return (
    <div className="animate-fade mx-auto max-w-md space-y-5 pt-2">
      <div className="px-1">
        <h1 className="text-[1.75rem] font-bold tracking-tight text-label">Besitzer fragen</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">Zu {productName}</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
        placeholder="Was möchtest du von echten Besitzern wissen?"
        className="w-full rounded-[var(--radius-lg)] bg-surface p-4 text-[1.0625rem] leading-snug text-label outline-none placeholder:text-faint"
      />

      <div>
        <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
          {aiSuggested ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
              Vorgeschlagene Fragen
            </>
          ) : (
            'Häufige Fragen'
          )}
        </p>
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
          {suggestions.map((q, i) => (
            <button
              key={q}
              onClick={() => setText(q)}
              className={
                'tap flex w-full items-center px-4 py-3 text-left text-[1.0625rem] text-label ' +
                (i < suggestions.length - 1 ? 'hairline' : '')
              }
              style={{ ['--hairline-inset' as string]: '1rem' }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

      <Button fullWidth size="lg" loading={submitting} onClick={submit}>
        Frage abschicken
      </Button>
    </div>
  );
}
