'use client';

import { useState } from 'react';
import { Check, Send, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

/**
 * "Lass es einen Bekannten bewerten" — generates a no-login invite link for the
 * product and opens the native share sheet (WhatsApp/E-Mail/SMS), falling back to
 * copy-to-clipboard. The recipient rates in a couple of taps at /e/<token>.
 */
export function InviteButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);

  const invite = async () => {
    setBusy(true);
    try {
      const { url } = await api.invites.create(productId);
      const absolute = `${window.location.origin}${url}`;
      const text = `Du besitzt „${productName}"? Bewerte es in 10 Sekunden — ohne Anmeldung:`;
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Wudly — kurz bewerten', text, url: absolute }).catch(() => {});
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

  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <UserPlus className="h-[1.3rem] w-[1.3rem]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold leading-snug text-label">
          Kennst du jemanden mit diesem Produkt?
        </p>
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">
          Lass es ihn in 10 Sekunden bewerten — ohne Anmeldung.
        </p>
      </div>
      <button
        onClick={invite}
        disabled={busy}
        className="press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[0.875rem] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {shared ? (
          <Check className="h-4 w-4" strokeWidth={2.6} />
        ) : (
          <Send className="h-4 w-4" strokeWidth={2.2} />
        )}
        {shared ? 'Geteilt' : 'Fragen'}
      </button>
    </div>
  );
}
