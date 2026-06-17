'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Check, Loader2, PackageX } from 'lucide-react';
import type { PublicInviteDto, WouldBuyAgain } from '@wudly/shared';
import { WOULD_BUY_AGAIN_OPTIONS } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';

const choiceTone: Record<string, string> = {
  positive: 'border-positive/60 bg-positive-soft text-positive-ink',
  negative: 'border-regret/60 bg-regret-soft text-regret-ink',
  warning: 'border-unsure/60 bg-unsure-soft text-unsure-ink',
  neutral: 'border-border-strong text-label',
};

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-ambient fixed inset-0 z-[60] overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-10">{children}</div>
    </div>
  );
}

const inputCls =
  'w-full rounded-[var(--radius-md)] bg-surface px-4 py-3 text-[1rem] text-label shadow-[0_0_0_1px_var(--color-border)] outline-none placeholder:text-faint';

export function InviteRatingClient({
  token,
  invite,
}: {
  token: string;
  invite: PublicInviteDto | null;
}) {
  const { user, register, login } = useAuth();
  const [choice, setChoice] = useState<WouldBuyAgain | null>(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [claimed, setClaimed] = useState(false);

  // Inline account creation / login on the thank-you screen.
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // If a session appears (same browser, or after inline auth), upgrade the vote.
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if (
      sessionStorage.getItem(`wudly-rated-${token}`) &&
      !sessionStorage.getItem(`wudly-claimed-${token}`)
    ) {
      void api.invites
        .claim(token)
        .then(() => {
          sessionStorage.setItem(`wudly-claimed-${token}`, '1');
          setClaimed(true);
        })
        .catch(() => {});
    }
  }, [user, token]);

  if (!invite || !invite.active) {
    return (
      <FullScreen>
        <div className="m-auto text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-fill-2 text-faint">
            <PackageX className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <h1 className="text-[1.25rem] font-bold text-label">Einladung nicht mehr gültig</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            Dieser Link ist abgelaufen oder wurde bereits genutzt.
          </p>
          <Link href="/check" className="mt-6 inline-block">
            <Button variant="tinted">Wudly entdecken</Button>
          </Link>
        </div>
      </FullScreen>
    );
  }

  const submit = async () => {
    if (!choice) return;
    setSubmitting(true);
    try {
      await api.invites.rate(token, {
        wouldBuyAgain: choice,
        guestName: name.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      sessionStorage.setItem(`wudly-rated-${token}`, '1');
      if (user) {
        await api.invites.claim(token).catch(() => {});
        sessionStorage.setItem(`wudly-claimed-${token}`, '1');
        setClaimed(true);
      }
      setDone(true);
    } catch {
      setSubmitting(false);
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || password.length < 8) {
      setAuthError('E-Mail und ein Passwort mit mind. 8 Zeichen.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === 'register') {
        await register({ email: email.trim(), password, displayName: name.trim() || undefined });
      } else {
        await login({ email: email.trim(), password });
      }
      await api.invites.claim(token).catch(() => {});
      sessionStorage.setItem(`wudly-claimed-${token}`, '1');
      setClaimed(true);
    } catch (err) {
      setAuthError(
        err instanceof ApiError ? err.displayMessage : 'Hat nicht geklappt — bitte prüfen.',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  if (done) {
    const counted = Boolean(user) || claimed;
    return (
      <FullScreen>
        <div className="m-auto w-full text-center">
          <span className="animate-pop mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-[var(--shadow-glow)]">
            <Check className="h-8 w-8" strokeWidth={2.6} />
          </span>
          <h1 className="font-display text-[2rem] font-semibold leading-tight text-label">
            Danke{name ? `, ${name.trim()}` : ''}!
          </h1>
          <p className="mt-2 text-pretty text-[1rem] leading-snug text-muted-foreground">
            Deine Bewertung zu „{invite.product.canonicalName}" ist da.
          </p>

          {counted ? (
            <div className="card mt-7 p-5 text-left">
              <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-positive-ink">
                <BadgeCheck className="h-5 w-5" strokeWidth={2.3} /> Volle Wertung
              </p>
              <p className="mt-1.5 text-[0.875rem] leading-snug text-muted-foreground">
                Du bist als echter Besitzer dabei — deine Stimme zählt zu 100 %, und du wirst gefragt,
                wenn jemand etwas zu „{invite.product.canonicalName}" wissen will.
              </p>
            </div>
          ) : (
            <div className="card mt-7 space-y-3 p-5 text-left">
              <p className="text-[0.9375rem] font-semibold text-label">
                Damit deine Stimme zu 100 % zählt
              </p>
              <p className="text-[0.8125rem] leading-snug text-muted-foreground">
                {authMode === 'register'
                  ? 'Konto in 20 Sekunden — dann zählst du als echter Besitzer und kannst selbst gefragt werden.'
                  : 'Melde dich an, um deine Bewertung voll zu werten.'}
              </p>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail"
                className={inputCls}
              />
              <input
                type="password"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMode === 'register' ? 'Passwort (mind. 8 Zeichen)' : 'Passwort'}
                className={inputCls}
              />
              {authError && <p className="text-[0.8125rem] text-regret">{authError}</p>}
              <Button variant="brand" fullWidth loading={authBusy} onClick={handleAuth}>
                {authMode === 'register' ? 'Konto erstellen & voll zählen' : 'Einloggen & voll zählen'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode((m) => (m === 'register' ? 'login' : 'register'));
                }}
                className="tap-dim block w-full text-center text-[0.8125rem] font-medium text-accent-ink"
              >
                {authMode === 'register' ? 'Schon ein Konto? Einloggen' : 'Neu hier? Konto erstellen'}
              </button>
            </div>
          )}

          <Link
            href="/check"
            className="mt-6 inline-block text-[0.9375rem] font-medium text-accent-ink"
          >
            Wudly entdecken →
          </Link>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <div className="text-center">
        {invite.inviterName && (
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">
            {invite.inviterName} fragt dich
          </p>
        )}
        <div className="mx-auto mt-3 h-24 w-24 overflow-hidden rounded-[var(--radius-lg)] bg-surface-muted shadow-card">
          {invite.product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invite.product.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="grid h-full w-full place-items-center font-display text-[2rem] text-faint">
              {invite.product.canonicalName.slice(0, 1)}
            </span>
          )}
        </div>
        <h1 className="mt-4 text-[1.35rem] font-bold leading-tight text-label">
          {invite.product.canonicalName}
        </h1>
        {invite.product.brand && (
          <p className="text-[0.9375rem] text-muted-foreground">{invite.product.brand}</p>
        )}
        {user && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-3 py-1 text-[0.75rem] font-semibold text-positive-ink">
            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
            Eingeloggt als {user.displayName ?? user.email} · zählt voll
          </p>
        )}
      </div>

      <p className="mt-8 text-center font-display text-[1.5rem] font-semibold leading-tight text-label">
        Würdest du es <span className="text-accent-ink">wieder kaufen</span>?
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {WOULD_BUY_AGAIN_OPTIONS.map((opt) => {
          const active = choice === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                navigator.vibrate?.(6);
                setChoice(opt.value);
              }}
              className={`press flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border-2 py-4 transition-colors ${
                active ? choiceTone[opt.tone ?? 'neutral'] : 'border-border bg-surface text-muted-foreground'
              }`}
            >
              <span className="text-[1.6rem] leading-none">{opt.emoji}</span>
              <span className="text-[0.875rem] font-semibold">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="animate-rise mt-5 space-y-3">
          {!user && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Vorname (optional)"
              maxLength={60}
              className={inputCls}
            />
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kurz: warum? (optional)"
            rows={3}
            maxLength={600}
            className={inputCls}
          />
        </div>
      )}

      <div className="mt-auto pt-6">
        <Button variant="brand" size="lg" fullWidth loading={submitting} disabled={!choice} onClick={submit}>
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Bewertung abschicken'}
        </Button>
        <p className="mt-3 text-center text-[0.75rem] text-faint">
          {user ? 'Zählt sofort voll' : 'Keine Anmeldung nötig · 1 Klick · anonym möglich'}
        </p>
      </div>
    </FullScreen>
  );
}
