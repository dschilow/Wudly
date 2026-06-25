import { ExternalLink, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ExternalConsensusDto } from '@wudly/shared';

/** Cached, source-backed themes from public reviews. Never part of the Wudly Signal. */
export function ExternalConsensusCard({ consensus }: { consensus: ExternalConsensusDto }) {
  return (
    <div className="card space-y-4 p-4">
      {consensus.summary && (
        <p className="text-[0.9375rem] leading-relaxed text-label">{consensus.summary}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <ThemeList title="Häufig gelobt" items={consensus.positiveThemes} icon={<Plus className="h-4 w-4 text-positive-ink" strokeWidth={2.4} />} />
        <ThemeList title="Wiederholt kritisiert" items={consensus.negativeThemes} icon={<Minus className="h-4 w-4 text-regret-ink" strokeWidth={2.4} />} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {consensus.sourceUrls.slice(0, 8).map((url) => (
          <a key={url} href={url} target="_blank" rel="noopener nofollow" className="tap inline-flex items-center gap-1 rounded-full bg-fill-2 px-2.5 py-1 text-[0.75rem] text-muted-foreground">
            {domain(url)} <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ))}
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        Öffentliche Quellen, zuletzt geprüft am {new Intl.DateTimeFormat('de-DE').format(new Date(consensus.fetchedAt))}.
      </p>
    </div>
  );
}

function ThemeList({ title, items, icon }: { title: string; items: ExternalConsensusDto['positiveThemes']; icon: ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wide text-label-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => <li key={item.label} className="flex items-start gap-2 text-[0.875rem] text-label"><span className="mt-0.5 shrink-0">{icon}</span><span>{item.label}</span></li>)}
      </ul>
    </div>
  );
}

function domain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Quelle'; }
}
