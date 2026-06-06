import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Empty state: a centered title + gray description. When an `icon` node is
 * supplied it renders inside a soft, gently popped-in medallion — a small moment
 * of delight so empty screens feel intentional rather than broken. Pass a
 * rendered element (e.g. `<Package className="h-7 w-7" />`), not a component.
 */
export function EmptyState({
  icon,
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
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <span className="animate-pop mb-4 grid h-14 w-14 place-items-center rounded-full bg-fill-2 text-faint">
          {icon}
        </span>
      )}
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
