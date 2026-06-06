'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { api } from './api';
import { useAuth } from './auth-context';

interface NotificationsState {
  unreadCount: number;
  /** Re-fetch the unread count now (e.g. after opening the inbox). */
  refresh: () => Promise<void>;
  /** Optimistically reset the badge to zero. */
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

const POLL_MS = 20_000;

/**
 * Lightweight unread-badge state for the notification bell. Polls the cheap
 * `unread-count` endpoint while a user is signed in; pauses when signed out or
 * when the tab is hidden. The full list is fetched on the inbox page itself.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count } = await api.notifications.unreadCount({ cache: 'no-store' });
      setUnreadCount(count);
    } catch {
      /* offline / not authed — leave the badge as-is */
    }
  }, [user]);

  const clear = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    void refresh();

    const start = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void refresh();
        start();
      }
    };
    const onFocus = () => void refresh();

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refresh]);

  // Refresh the badge on every navigation so new questions surface quickly.
  useEffect(() => {
    if (user) void refresh();
  }, [pathname, user, refresh]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
