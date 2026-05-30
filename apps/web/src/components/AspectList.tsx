import type { AspectStatDto } from '@wudly/shared';

interface AspectListProps {
  title?: string;
  aspects: AspectStatDto[];
  tone: 'positive' | 'negative';
  emptyHint?: string;
}

/** Ranked strengths/weaknesses with a subtle frequency meter. */
export function AspectList({ title, aspects, tone, emptyHint }: AspectListProps) {
  const isPos = tone === 'positive';
  const color = isPos ? 'var(--color-positive)' : 'var(--color-regret)';
  const max = aspects.reduce((m, a) => Math.max(m, a.count), 0) || 1;

  return (
    <div>
      {title ? <h3 className="mb-3 text-[0.9375rem] font-semibold text-label">{title}</h3> : null}
      {aspects.length === 0 ? (
        <p className="text-[0.9375rem] text-muted-foreground">{emptyHint ?? 'Noch keine Angaben.'}</p>
      ) : (
        <ul className="space-y-3">
          {aspects.map((aspect) => (
            <li key={aspect.key}>
              <div className="flex items-center justify-between text-[0.9375rem]">
                <span className="text-label">{aspect.label}</span>
                <span className="text-[0.8125rem] tnum text-faint">{aspect.count}×</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill-2">
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
