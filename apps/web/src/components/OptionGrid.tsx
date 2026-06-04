'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Option<T extends string> {
  value: T;
  label: string;
  emoji?: string;
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
}

interface OptionGridProps<T extends string> {
  options: ReadonlyArray<Option<T>>;
  value: T | null;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}

/**
 * iOS selection list: rows in a grouped container, hairline separators, a leading
 * emoji and a blue checkmark on the selected row (UITableViewCell checkmark style).
 */
export function OptionGrid<T extends string>({ options, value, onChange }: OptionGridProps<T>) {
  return (
    <div className="card overflow-hidden">
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'tap flex w-full items-center gap-3 px-4 py-3 text-left',
              i < options.length - 1 && 'hairline',
            )}
            style={{ ['--hairline-inset' as string]: opt.emoji ? '3.25rem' : '1rem' }}
          >
            {opt.emoji && (
              <span className="text-[1.35rem] leading-none" aria-hidden>
                {opt.emoji}
              </span>
            )}
            <span className="flex-1 text-[1.0625rem] text-label">{opt.label}</span>
            {selected && (
              <Check className="h-[1.25rem] w-[1.25rem] text-accent" strokeWidth={3} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface MultiSelectChipsProps {
  options: ReadonlyArray<{ key: string; label: string }>;
  selected: string[];
  onToggle: (key: string) => void;
  tone?: 'positive' | 'negative';
}

/** Multi-select chips for the optional likes/dislikes step. */
export function MultiSelectChips({
  options,
  selected,
  onToggle,
  tone = 'positive',
}: MultiSelectChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onToggle(opt.key)}
            className={cn(
              'tap-dim rounded-full px-3.5 py-2 text-[0.9375rem] font-medium',
              active
                ? tone === 'positive'
                  ? 'bg-positive-soft text-positive-ink'
                  : 'bg-regret-soft text-regret-ink'
                : 'bg-fill-2 text-label',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
