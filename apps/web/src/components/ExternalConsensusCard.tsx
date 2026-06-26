import { AlertTriangle, ExternalLink, Globe2, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  externalRatingPercent,
  formatExternalRating,
  formatRatingCount,
  type ExternalConsensusDto,
  type ExternalRatingDto,
} from '@wudly/shared';

/** Source-backed editorial brief from public product reviews. Never part of the Wudly Signal. */
export function ExternalConsensusCard({
  consensus,
  ratings,
}: {
  consensus: ExternalConsensusDto | null;
  ratings: ExternalRatingDto[];
}) {
  const sources = uniqueSources(consensus, ratings);
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border bg-[linear-gradient(135deg,rgba(38,208,124,0.09),transparent_58%)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="mono-data flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.17em] text-accent">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Externe Review-Lage
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 py-1 text-[0.75rem] font-medium text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5" aria-hidden />
            {sources.length} {sources.length === 1 ? 'Quelle' : 'Quellen'}
          </span>
        </div>
        <h3 className="mt-2 text-[1.125rem] font-semibold tracking-[-0.015em] text-label">
          Was Tests und öffentliche Bewertungen zeigen
        </h3>
        {consensus?.summary && (
          <p className="mt-4 max-w-3xl text-[0.9375rem] leading-[1.65] text-label">
            {consensus.summary}
          </p>
        )}
      </div>

      {ratings.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-px bg-border">
          {ratings.map((rating) => <RatingTile key={rating.id} rating={rating} />)}
        </div>
      )}

      {consensus &&
        (consensus.positiveThemes.length > 0 || consensus.negativeThemes.length > 0) && (
          <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-2 sm:p-5">
            <ThemeList
              title="Wiederholt gelobt"
              items={consensus.positiveThemes}
              icon={<ShieldCheck className="h-4 w-4 text-positive-ink" strokeWidth={2.2} />}
              tone="positive"
            />
            <ThemeList
              title="Wiederholt kritisiert"
              items={consensus.negativeThemes}
              icon={<AlertTriangle className="h-4 w-4 text-regret-ink" strokeWidth={2.2} />}
              tone="negative"
            />
          </div>
        )}

      <div className="border-t border-border px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap gap-2">
          {sources.slice(0, 8).map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener nofollow" className="tap inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-2.5 py-1 text-[0.75rem] text-muted-foreground transition-colors hover:text-label">
              {domain(url)} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ))}
        </div>
        <p className="mt-3 text-[0.75rem] leading-relaxed text-muted-foreground">
          Automatisch aus verlinkten Produktquellen zusammengefasst. Externe Werte und Aussagen
          fließen nicht in das Wudly Signal ein; dieses basiert ausschließlich auf Wudly-Besitzern.
          {consensus && ` Zuletzt geprüft am ${new Intl.DateTimeFormat('de-DE').format(new Date(consensus.fetchedAt))}.`}
        </p>
      </div>
    </div>
  );
}

function RatingTile({ rating }: { rating: ExternalRatingDto }) {
  const percent = externalRatingPercent(rating);
  return (
    <a href={rating.url} target="_blank" rel="noopener nofollow" className="tap group bg-surface p-4 transition-colors hover:bg-fill-1 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.875rem] font-semibold text-label">{rating.sourceLabel}</p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            {rating.count !== null ? `${formatRatingCount(rating.count)} Bewertungen` : 'Redaktionelle Produktbewertung'}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-label-3 transition-colors group-hover:text-label" aria-hidden />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="mono-data text-[1.25rem] font-semibold tracking-tight text-label">
          {formatExternalRating(rating)}
        </span>
        {rating.kind === 'STARS' && <Star className="mb-1 h-4 w-4 fill-current text-amber-400" aria-hidden />}
      </div>
      {percent !== null && (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-fill-2">
          <span className="block h-full rounded-full bg-label-2" style={{ width: `${percent}%` }} />
        </span>
      )}
    </a>
  );
}

function ThemeList({ title, items, icon, tone }: { title: string; items: ExternalConsensusDto['positiveThemes']; icon: ReactNode; tone: 'positive' | 'negative' }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2.5 flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-label-3">
        {icon}{title}
      </h4>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className={`rounded-xl border px-3 py-2.5 text-[0.875rem] leading-snug text-label ${tone === 'positive' ? 'border-positive/20 bg-positive/5' : 'border-regret/20 bg-regret/5'}`}>
            <span>{item.label}</span>
            <span className="mt-1 block text-[0.6875rem] text-muted-foreground">
              bestätigt durch {new Set(item.sourceUrls.map(domain)).size} unabhängige Quellen
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function uniqueSources(consensus: ExternalConsensusDto | null, ratings: ExternalRatingDto[]): string[] {
  return [...new Set([...(consensus?.sourceUrls ?? []), ...ratings.map((rating) => rating.url)])];
}

function domain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Quelle'; }
}
