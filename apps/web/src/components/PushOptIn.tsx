'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type State =
  | 'idle'
  | 'working'
  | 'enabled'
  | 'denied'
  | 'unsupported'
  | 'unconfigured'
  | 'error';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  // Build on an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>
  // (what PushManager.subscribe's applicationServerKey expects).
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; detect via touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Opt-in card for Web Push (real device notifications for new questions). */
export function PushOptIn() {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    void (async () => {
      if (!pushSupported()) {
        setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub && Notification.permission === 'granted') setState('enabled');
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function enable() {
    if (!pushSupported()) {
      setState('unsupported');
      return;
    }
    setState('working');
    try {
      const { publicKey } = await api.notifications.pushKey({ cache: 'no-store' });
      if (!publicKey) {
        setState('unconfigured');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setState('error');
        return;
      }
      await api.notifications.pushSubscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      navigator.vibrate?.(18);
      setState('enabled');
    } catch {
      setState('error');
    }
  }

  // On iOS, Web Push only exists once the PWA is installed to the home screen —
  // guide the user there instead of silently showing nothing.
  if (state === 'unsupported') {
    if (isIOS() && !isStandalone()) {
      return (
        <div className="card flex items-start gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Bell className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] font-semibold leading-tight text-label">
              Push auf dem iPhone aktivieren
            </div>
            <div className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
              Tippe in Safari auf <span className="font-medium text-label">Teilen</span> →{' '}
              <span className="font-medium text-label">„Zum Home-Bildschirm"</span>, öffne Wudly über
              das neue Icon und aktiviere die Benachrichtigungen dann hier. (Apple erlaubt Push nur
              für installierte Web-Apps.)
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  if (state === 'enabled') {
    return (
      <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] bg-positive-soft px-4 py-3 text-[0.875rem] font-medium text-positive-ink">
        <BellRing className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={2.2} />
        Push aktiv — du wirst bei neuen Fragen benachrichtigt, auch wenn die App zu ist.
      </div>
    );
  }

  const message =
    state === 'denied'
      ? 'Im Browser blockiert — erlaube Benachrichtigungen in den Seiteneinstellungen.'
      : state === 'unconfigured'
        ? 'Push ist serverseitig noch nicht aktiviert.'
        : state === 'error'
          ? 'Konnte nicht aktiviert werden. Versuch es nochmal.'
          : 'Werde benachrichtigt, sobald jemand zu deinen Produkten fragt — auch bei geschlossener App.';

  const showButton = state === 'idle' || state === 'working' || state === 'error';

  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Bell className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.9375rem] font-semibold leading-tight text-label">
          Push-Benachrichtigungen
        </div>
        <div className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">{message}</div>
      </div>
      {showButton && (
        <button
          type="button"
          onClick={enable}
          disabled={state === 'working'}
          className="press flex h-9 shrink-0 items-center gap-1.5 rounded-[0.75rem] bg-accent px-3.5 text-[0.875rem] font-semibold text-white disabled:opacity-70"
        >
          {state === 'working' && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />}
          Aktivieren
        </button>
      )}
    </div>
  );
}
