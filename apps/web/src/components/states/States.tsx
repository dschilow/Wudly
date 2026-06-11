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

/** Lightweight skeleton block — a soft traveling shimmer, not a flat pulse. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-[0.5rem]', className)} />;
}

/** A grouped-list skeleton — one card with N hairline-divided thumbnail rows. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 px-4 py-3', i < rows - 1 && 'hairline')}
        >
          <Skeleton className="h-11 w-11 rounded-[0.7rem]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-10 rounded-[0.5rem]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Generic full-page skeleton — a large-title placeholder over a list. Used as the
 * default route/Suspense fallback so navigations reveal the page's shape instantly
 * instead of a blank spinner (perceived performance + polish).
 */
export function PageSkeleton() {
  return (
    <div className="animate-fade space-y-5 pt-2">
      <div className="space-y-2.5 px-1 pt-2">
        <Skeleton className="h-9 w-2/3 rounded-[0.6rem]" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}
