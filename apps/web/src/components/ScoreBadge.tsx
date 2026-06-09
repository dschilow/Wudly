import { formatScore } from '@/lib/utils';
import { rebuyVerdict } from '@/lib/verdict';

/**
 * The compact, designed expression of a product's score in a list row: a tinted
 * rounded chip holding the number, with the one-word verdict beneath it. Color
 * carries the meaning (green/amber/red), so the row reads at a glance.
 */
export function ScoreBadge({
  score,
  kind = 'rebuy',
  labelOverride,
}: {
  score: number | null;
  kind?: 'rebuy' | 'regret';
  labelOverride?: string;
}) {
  if (kind === 'regret') {
    const strong = score !== null && score >= 40;
    const color = strong ? 'var(--color-regret)' : 'var(--color-muted-foreground)';
    const soft = strong ? 'var(--color-regret-soft)' : 'var(--color-fill-2)';
    return (
      <div className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1">
        <div
          className="grid h-[2.75rem] w-[2.75rem] place-items-center rounded-[0.85rem]"
          style={{ background: soft }}
        >
          <span className="text-[1.25rem] font-bold tnum leading-none" style={{ color }}>
            {formatScore(score)}
          </span>
        </div>
        <span className="text-[0.625rem] font-semibold tracking-wide" style={{ color }}>
          {labelOverride ?? 'Regret'}
        </span>
      </div>
    );
  }

  const v = rebuyVerdict(score);
  return (
    <div className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1">
      <div
        className="grid h-[2.75rem] w-[2.75rem] place-items-center rounded-[0.85rem]"
        style={{ background: v.soft }}
      >
        <span className="text-[1.25rem] font-bold tnum leading-none" style={{ color: v.color }}>
          {score === null && labelOverride ? '•' : formatScore(score)}
        </span>
      </div>
      <span className="text-[0.625rem] font-semibold tracking-wide" style={{ color: v.ink }}>
        {labelOverride ?? v.short}
      </span>
    </div>
  );
}
