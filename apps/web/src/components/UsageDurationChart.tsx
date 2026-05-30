import { USAGE_DURATION_OPTIONS, type UsageDuration } from '@wudly/shared';

interface UsageDurationChartProps {
  stats: Record<UsageDuration, number>;
}

/** Horizontal distribution of how long owners have used the product. */
export function UsageDurationChart({ stats }: UsageDurationChartProps) {
  const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Angaben zur Nutzungsdauer.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {USAGE_DURATION_OPTIONS.map((opt) => {
        const count = stats[opt.value] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <li key={opt.value} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs font-medium text-ink">{opt.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
              {count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
