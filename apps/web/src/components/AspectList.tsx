import { ThumbsUp, ThumbsDown } from 'lucide-react';
import type { AspectStatDto } from '@wudly/shared';

interface AspectListProps {
  title: string;
  aspects: AspectStatDto[];
  tone: 'positive' | 'negative';
  emptyHint?: string;
}

/** Ranked list of strengths/weaknesses with a frequency meter. */
export function AspectList({ title, aspects, tone, emptyHint }: AspectListProps) {
  const isPos = tone === 'positive';
  const Icon = isPos ? ThumbsUp : ThumbsDown;
  const color = isPos ? 'var(--color-positive)' : 'var(--color-regret)';
  const max = aspects.reduce((m, a) => Math.max(m, a.count), 0) || 1;

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <Icon className="h-4 w-4" style={{ color }} strokeWidth={2.2} aria-hidden />
        {title}
      </h3>
      {aspects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint ?? 'Noch keine Angaben.'}</p>
      ) : (
        <ul className="space-y-2.5">
          {aspects.map((aspect) => (
            <li key={aspect.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{aspect.label}</span>
                <span className="text-xs font-semibold text-faint tnum">{aspect.count}×</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((aspect.count / max) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
