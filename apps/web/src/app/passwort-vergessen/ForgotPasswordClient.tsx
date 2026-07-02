'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordResetSchema } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/Logo';

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const inputCls =
    'w-full bg-transparent px-4 py-3 text-[1.0625rem] text-label outline-none placeholder:text-faint';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = requestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Bitte eine gültige E-Mail eingeben.');
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.requestPasswordReset({ email });
      // Always show success — the backend never reveals whether the email exists.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Das hat leider nicht geklappt.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-fade mx-auto max-w-md pt-10 text-center">
        <LogoMark size={56} className="mx-auto" />
        <h1 className="mt-4 text-[1.75rem] font-bold tracking-tight text-label">
          Prüfe dein Postfach
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Falls ein Konto mit <span className="font-medium text-label">{email}</span> existiert,
          haben wir dir einen Link zum Zurücksetzen geschickt. Der Link ist 1 Stunde gültig.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[0.9375rem] font-medium text-accent">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade mx-auto max-w-md pt-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={56} />
        <h1 className="mt-4 text-[1.75rem] font-bold tracking-tight text-label">
          Passwort vergessen?
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
          Gib deine E-Mail ein — wir schicken dir einen Link zum Zurücksetzen.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card overflow-hidden">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            autoComplete="email"
            autoFocus
            className={inputCls}
          />
        </div>

        {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          Link zusenden
        </Button>
      </form>

      <p className="mt-5 text-center text-[0.9375rem] text-muted-foreground">
        <Link href="/login" className="font-medium text-accent">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
