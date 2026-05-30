'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COMMON_QUESTIONS } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function AskClient({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { show } = useToast();

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="mx-auto max-w-md pt-8 text-center">
        <div className="text-4xl" aria-hidden>
          💬
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">Frage an Besitzer</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Melde dich an, um Besitzern von „{productName}" eine Frage zu stellen.
        </p>
        <Link
          href={`/login?redirect=/products/${productId}/ask`}
          className="mt-5 inline-flex h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
        >
          Anmelden / Registrieren
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="animate-rise">
        <h1 className="text-2xl font-extrabold text-ink">Besitzer fragen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zu <span className="font-semibold text-ink">{productName}</span>
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
        placeholder="Was möchtest du von echten Besitzern wissen?"
        className="w-full rounded-2xl border border-border-strong bg-surface p-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Häufige Fragen
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setText(q)}
              className="rounded-full border border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-regret-ink">{error}</p>}

      <Button fullWidth size="lg" loading={submitting} onClick={submit}>
        Frage abschicken
      </Button>
    </div>
  );
}
