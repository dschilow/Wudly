import { USAGE_DURATION_OPTIONS, type UsageDuration } from '@wudly/shared';

interface UsageDurationChartProps {
  stats: Record<UsageDuration, number>;
}

/** Horizontal distribution of how long owners have used the product. */
export function UsageDurationChart({ stats }: UsageDurationChartProps) {
  const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return (
      <p className="text-[0.9375rem] text-muted-foreground">Noch keine Angaben zur Nutzungsdauer.</p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {USAGE_DURATION_OPTIONS.map((opt) => {
        const count = stats[opt.value] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <li key={opt.value} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-[0.8125rem] text-muted-foreground">{opt.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-[0.8125rem] tnum text-faint">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}
