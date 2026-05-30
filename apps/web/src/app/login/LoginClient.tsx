'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerSchema, loginSchema } from '@wudly/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/me';
  const { user, login, register } = useAuth();
  const { show } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already logged in → leave the auth page.
  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const schema = mode === 'register' ? registerSchema : loginSchema;
    const parsed = schema.safeParse(
      mode === 'register'
        ? { email, password, displayName: displayName || undefined }
        : { email, password },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Bitte Eingaben prüfen.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register({ email, password, displayName: displayName || undefined });
        show('Willkommen bei Wudly 🎉', 'success');
      } else {
        await login({ email, password });
        show('Angemeldet 👋', 'success');
      }
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Anmeldung fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-xl font-black text-white">
          W
        </span>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">
          {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Melde dich an, um Erfahrungen zu teilen.'
            : 'Kostenlos. Teile Erfahrungen und frage Besitzer.'}
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-3.5">
          {mode === 'register' && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">
                Anzeigename <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="z. B. Lena"
                className="h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">E-Mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@example.com"
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Passwort</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mindestens 8 Zeichen' : '••••••••'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="h-12 w-full rounded-2xl border border-border-strong bg-surface px-4 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </label>

          {error && <p className="text-sm font-medium text-regret-ink">{error}</p>}

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === 'login' ? 'Noch kein Konto?' : 'Schon registriert?'}{' '}
        <button
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError(null);
          }}
          className="font-semibold text-accent hover:underline"
        >
          {mode === 'login' ? 'Registrieren' : 'Anmelden'}
        </button>
      </p>
    </div>
  );
}
