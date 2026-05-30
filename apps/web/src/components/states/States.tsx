import type { ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LucideIcon {
  className?: string;
  strokeWidth?: number;
}

/**
 * iOS-quiet empty state: centered title + gray description, no big decorative
 * icon by default (icon prop kept for back-compat but unused visually).
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<LucideIcon> | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <h3 className="text-[1.0625rem] font-semibold text-label">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-pretty text-[0.9375rem] leading-snug text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-20 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-faint" aria-hidden />
      {label && <span className="text-[0.9375rem]">{label}</span>}
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
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <h3 className="text-[1.0625rem] font-semibold text-regret">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-[0.9375rem] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Lightweight skeleton block for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-[0.5rem] bg-fill-2', className)}
      style={{ animationDuration: '1.4s' }}
    />
  );
}
