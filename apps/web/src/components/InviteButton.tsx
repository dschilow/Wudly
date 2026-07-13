'use client';

import { useEffect, useState } from 'react';
import { Check, Send, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';

/**
 * One-time owner invite. It is intentionally only visible to a current owner;
 * the API enforces the same rule and each link can be claimed once.
 */
export function InviteButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const { user, loading } = useAuth();
  const { show } = useToast();
  const [isOwner, setIsOwner] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!user) {
      setIsOwner(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    void api.ownership
      .mine({ cache: 'no-store' })
      .then((ownerships) => {
        if (active) setIsOwner(ownerships.some((ownership) => ownership.productId === productId));
      })
      .catch(() => {
        if (active) setIsOwner(false);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [loading, productId, user]);

  const invite = async () => {
    setBusy(true);
    try {
      const { url } = await api.invites.create(productId);
      const absolute = `${window.location.origin}${url}`;
      const text = `Du besitzt „${productName}“? Teile deine Erfahrung in wenigen Sekunden – ohne Rechnung:`;
      if (navigator.share) {
        await navigator.share({ title: 'Wudly – Erfahrung teilen', text, url: absolute });
      } else {
        await navigator.clipboard.writeText(absolute);
        show('Einladungslink kopiert', 'success');
      }
      setShared(true);
    } catch {
      show('Konnte den Link nicht erstellen.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || checking || !isOwner) return null;

  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <UserPlus className="h-[1.3rem] w-[1.3rem]" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold leading-snug text-label">
          Kennst du noch einen Besitzer?
        </p>
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">
          Einmal-Link senden – ohne Rechnung, ohne langes Formular.
        </p>
      </div>
      <button
        type="button"
        onClick={invite}
        disabled={busy || shared}
        className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[0.875rem] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {shared ? (
          <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
        ) : (
          <Send className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        )}
        {shared ? 'Gesendet' : 'Einladen'}
      </button>
    </div>
  );
}
