'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { NotificationsProvider } from '@/lib/notifications-context';
import { ToastProvider } from '@/components/ui/Toast';

/** Client-side provider tree (auth + notifications + toasts). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <ToastProvider>{children}</ToastProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
