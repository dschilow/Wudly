'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const dotColor: Record<ToastTone, string> = {
  success: 'bg-positive',
  error: 'bg-regret',
  info: 'bg-faint',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="safe-top pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-sheet pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full bg-[#0b0e15]/90 px-4 py-2.5 text-[0.9375rem] font-medium text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.3)] backdrop-blur-xl"
            role="status"
          >
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', dotColor[toast.tone])}
              aria-hidden
            />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
