'use client';

import { cn } from '@/lib/utils';

interface Segment<T extends string> {
  value: T;
  label: string;
}

/**
 * iOS UISegmentedControl: a pill track with a sliding white "thumb" behind the
 * active segment. No icons — just clear, short labels.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
}: {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  );

  return (
    <div
      className={cn(
        'relative flex rounded-[0.5rem] bg-fill-2 p-0.5',
        className,
      )}
      role="tablist"
    >
      {/* sliding thumb */}
      <div
        className="absolute inset-y-0.5 rounded-[0.4375rem] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)] transition-transform duration-250 ease-[var(--ease-ios)]"
        style={{
          width: `calc((100% - 0.25rem) / ${segments.length})`,
          transform: `translateX(calc(${index} * 100%))`,
        }}
        aria-hidden
      />
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.value)}
            className={cn(
              'relative z-10 flex-1 truncate py-1.5 text-[0.8125rem] font-semibold transition-colors duration-200',
              active ? 'text-label' : 'text-muted-foreground active:opacity-50',
            )}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
