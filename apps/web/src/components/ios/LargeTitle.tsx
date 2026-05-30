import type { ReactNode } from 'react';

/**
 * iOS "Large Title" header rendered at the top of a screen's content. Big, bold,
 * left-aligned, with an optional trailing accessory and a thin subtitle.
 */
export function LargeTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1 pb-1 pt-1">
      <div className="min-w-0">
        <h1 className="text-[2.125rem] font-bold leading-[1.1] text-label">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.9375rem] text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0 pb-1">{trailing}</div>}
    </div>
  );
}
