import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon = '🔎',
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 text-4xl" aria-hidden>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Lädt…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <span
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-border-strong border-t-accent"
        aria-hidden
      />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function ErrorState({
  title = 'Etwas ist schiefgelaufen',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-regret-soft bg-regret-soft/40 px-6 py-12 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        ⚠️
      </div>
      <h3 className="text-lg font-bold text-regret-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-regret-ink/80">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Lightweight skeleton block for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-sunken', className)} />;
}
