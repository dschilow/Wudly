import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * iOS "inset grouped" list section. Rows live inside a rounded white container on
 * the grouped background; rows are separated by hairlines (handled per-row).
 */
export function ListGroup({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {header && (
        <h2 className="px-4 pb-1.5 pt-0 text-[0.8rem] font-normal uppercase tracking-[0.01em] text-muted-foreground">
          {header}
        </h2>
      )}
      <div className="card overflow-hidden">{children}</div>
      {footer && (
        <p className="px-4 pt-1.5 text-[0.8rem] leading-snug text-muted-foreground">{footer}</p>
      )}
    </section>
  );
}

interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Renders the row as a link with an iOS disclosure chevron. */
  href?: string;
  onPress?: () => void;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned secondary value (iOS "detail" text). */
  value?: ReactNode;
  /** Show the disclosure chevron (auto-true for href). */
  chevron?: boolean;
  /** Last row in a group → no hairline. */
  last?: boolean;
  destructive?: boolean;
}

/**
 * A single iOS list row: optional leading accessory, title (+subtitle), optional
 * right value, optional chevron, and a hairline separator inset to the text.
 */
const ListRowRoot = forwardRef<HTMLDivElement, ListRowProps>(function ListRow(
  {
    href,
    onPress,
    leading,
    title,
    subtitle,
    value,
    chevron,
    last,
    destructive,
    className,
    ...rest
  },
  ref,
) {
  const showChevron = chevron ?? Boolean(href || onPress);
  const interactive = Boolean(href || onPress);

  const inner = (
    <div
      ref={ref}
      className={cn(
        'relative flex min-h-[2.75rem] items-center gap-3 px-4 py-2.5',
        !last && 'hairline',
        interactive && 'tap',
        className,
      )}
      style={{ ['--hairline-inset' as string]: leading ? '3.75rem' : '1rem' }}
      {...rest}
    >
      {leading && <div className="flex shrink-0 items-center">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-[1.0625rem] leading-tight',
            destructive ? 'text-regret' : 'text-label',
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {value !== undefined && (
        <div className="shrink-0 text-[1.0625rem] text-muted-foreground">{value}</div>
      )}
      {showChevron && (
        <ChevronRight
          className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
          strokeWidth={2.5}
          aria-hidden
        />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  if (onPress) {
    return (
      <button onClick={onPress} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
});

export const ListRow = ListRowRoot as unknown as (props: ListRowProps) => any;
