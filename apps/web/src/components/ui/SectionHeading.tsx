import Link from 'next/link';
import type { ReactNode } from 'react';

/** Section title with optional "see all" link, used to head card lists. */
export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string } | ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action &&
        (typeof action === 'object' && action !== null && 'href' in action ? (
          <Link
            href={action.href}
            className="shrink-0 text-sm font-semibold text-accent hover:underline"
          >
            {action.label} →
          </Link>
        ) : (
          action
        ))}
    </div>
  );
}
