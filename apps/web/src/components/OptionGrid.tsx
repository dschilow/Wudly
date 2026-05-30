'use client';

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

const toneRing: Record<string, string> = {
  positive: 'ring-positive bg-positive-soft text-positive-ink',
  negative: 'ring-regret bg-regret-soft text-regret-ink',
  warning: 'ring-unsure bg-unsure-soft text-unsure-ink',
  neutral: 'ring-ink bg-ink text-white',
};

/** Large tap-friendly single-select option grid for the experience flow. */
export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 1,
}: OptionGridProps<T>) {
  return (
    <div
      className={cn(
        'grid gap-2.5',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const tone = opt.tone ?? 'neutral';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-left text-base font-semibold transition-all active:scale-[0.98]',
              selected
                ? cn('border-transparent ring-2', toneRing[tone])
                : 'border-border-strong bg-surface text-ink hover:bg-surface-sunken',
            )}
          >
            {opt.emoji && (
              <span className="text-xl" aria-hidden>
                {opt.emoji}
              </span>
            )}
            <span className="flex-1">{opt.label}</span>
            {selected && <span aria-hidden>✓</span>}
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
export function MultiSelectChips({ options, selected, onToggle, tone = 'positive' }: MultiSelectChipsProps) {
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
              'rounded-full border px-3.5 py-2 text-sm font-semibold transition-all active:scale-95',
              active
                ? tone === 'positive'
                  ? 'border-transparent bg-positive-soft text-positive-ink ring-2 ring-positive'
                  : 'border-transparent bg-regret-soft text-regret-ink ring-2 ring-regret'
                : 'border-border-strong bg-surface text-ink hover:bg-surface-sunken',
            )}
          >
            {active ? (tone === 'positive' ? '+ ' : '– ') : ''}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
