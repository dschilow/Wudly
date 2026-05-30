'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerSchema, loginSchema } from '@wudly/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/Logo';

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

  const inputCls =
    'w-full bg-transparent px-4 py-3 text-[1.0625rem] text-label outline-none placeholder:text-faint';

  return (
    <div className="animate-fade mx-auto max-w-md pt-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoMark size={56} />
        <h1 className="mt-4 text-[1.75rem] font-bold tracking-tight text-label">
          {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
          {mode === 'login'
            ? 'Melde dich an, um Erfahrungen zu teilen.'
            : 'Kostenlos. Teile Erfahrungen und frage Besitzer.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
          {mode === 'register' && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name (optional)"
              className={inputCls + ' hairline'}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            autoComplete="email"
            className={inputCls + ' hairline'}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Passwort (min. 8 Zeichen)' : 'Passwort'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            className={inputCls}
          />
        </div>

        {error && <p className="px-1 text-[0.9375rem] text-regret">{error}</p>}

        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </Button>
      </form>

      <p className="mt-5 text-center text-[0.9375rem] text-muted-foreground">
        {mode === 'login' ? 'Noch kein Konto? ' : 'Schon registriert? '}
        <button
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError(null);
          }}
          className="font-medium text-accent"
        >
          {mode === 'login' ? 'Registrieren' : 'Anmelden'}
        </button>
      </p>
    </div>
  );
}
