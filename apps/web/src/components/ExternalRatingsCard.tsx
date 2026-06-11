import { ExternalLink } from 'lucide-react';
import {
  externalRatingPercent,
  formatExternalRating,
  formatRatingCount,
  type ExternalRatingDto,
} from '@wudly/shared';

/**
 * "Bewertungen anderswo" — aggregated rating FACTS from other platforms.
 *
 * Transparency rules mirror the Showcase section: every value links to its
 * source, and nothing here flows into the Wudly Signal. The point is contrast:
 * "anderswo ★4,5 — aber nur 61 % echter Besitzer würden es wieder kaufen."
 */
export function ExternalRatingsCard({ ratings }: { ratings: ExternalRatingDto[] }) {
  if (ratings.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      {ratings.map((rating, i) => {
        const percent = externalRatingPercent(rating);
        return (
          <a
            key={rating.id}
            href={rating.url}
            target="_blank"
            rel="noopener nofollow"
            className={
              'tap flex items-center gap-3 px-4 py-3.5 ' +
              (i < ratings.length - 1 ? 'hairline' : '')
            }
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="text-[0.9375rem] font-semibold text-label">
                  {rating.sourceLabel}
                </span>
                {rating.count !== null && (
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {formatRatingCount(rating.count)} Bewertungen
                  </span>
                )}
                {rating.note && (
                  <span className="truncate text-[0.8125rem] text-muted-foreground">
                    {rating.note}
                  </span>
                )}
              </p>
              {percent !== null && (
                <span className="mt-1.5 block h-1.5 w-full max-w-[11rem] overflow-hidden rounded-full bg-fill-2">
                  {/* Deliberately neutral gray — external data never borrows the Signal green. */}
                  <span
                    className="block h-full rounded-full bg-label-2"
                    style={{ width: `${percent}%` }}
                  />
                </span>
              )}
            </div>
            <span className="mono-data shrink-0 text-[1rem] font-semibold text-label">
              {formatExternalRating(rating)}
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.2} />
          </a>
        );
      })}
    </div>
  );
}
