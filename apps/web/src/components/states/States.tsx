import type { ComponentType, ReactNode } from 'react';
import { SearchX, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LucideIcon {
  className?: string;
  strokeWidth?: number;
}

export function EmptyState({
  icon = SearchX,
  title,
  description,
  action,
  className,
}: {
  /** A lucide icon component (preferred) or any node (e.g. an emoji string). */
  icon?: ComponentType<LucideIcon> | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = typeof icon === 'function' ? (icon as ComponentType<LucideIcon>) : null;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-2xl)] border border-dashed border-border-strong bg-surface/50 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-2xl text-muted-foreground">
        {Icon ? <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden /> : (icon as ReactNode)}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-pretty text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Lädt…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden />
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
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-2xl)] border border-regret-soft bg-regret-soft/40 px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-regret-soft text-regret-ink">
        <AlertTriangle className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="text-base font-bold text-regret-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm text-regret-ink/80">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Lightweight skeleton block for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-lg)] bg-gradient-to-r from-surface-sunken via-border to-surface-sunken bg-[length:200%_100%]',
        className,
      )}
      style={{ animationDuration: '1.6s' }}
    />
  );
}
