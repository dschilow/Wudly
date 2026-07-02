'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPasswordSchema } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/Logo';

export function ResetPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { show } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    'w-full bg-transparent px-4 py-3 text-[1.0625rem] text-label outline-none placeholder:text-faint';

  if (!token) {
    return (
      <div className="animate-fade mx-auto max-w-md pt-10 text-center">
        <LogoMark size={56} className="mx-auto" />
        <h1 className="mt-4 text-[1.75rem] font-bold tracking-tight text-label">
          Link unvollständig
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Dieser Link enthält keinen gültigen Token. Fordere einen neuen Link an.
        </p>
        <Link
          href="/passwort-vergessen"
          className="mt-6 inline-block text-[0.9375rem] font-medium text-accent"
        >
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Bitte Eingaben prüfen.');
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.resetPassword({ token, password });
      show('Passwort geändert 🎉', 'success');
      router.replace('/login');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? 'Der Link ist ungültig oder abgelaufen. Fordere einen neuen an.'
            : err.displayMessage
          : 'Das hat leider nicht geklappt.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade mx-auto max-w-md pt-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={56} />
        <h1 className="mt-4 text-[1.75rem] font-bold tracking-tight text-label">
          Neues Passwort
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
          Wähle ein neues Passwort für dein Konto.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card overflow-hidden">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Neues Passwort (min. 8 Zeichen)"
            autoComplete="new-password"
            autoFocus
            className={inputCls + ' hairline'}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Passwort bestätigen"
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Passwort ändern
        </Button>
      </form>
    </div>
  );
}
