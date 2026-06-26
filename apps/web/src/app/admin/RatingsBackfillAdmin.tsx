'use client';

import { useState } from 'react';
import { Globe, Sparkles } from 'lucide-react';
import type { RatingBackfillReportDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
const UiCard = Card as any;
const UiButton = Button as any;
const UiPill = Pill as any;

/**
 * Admin panel: research "Bewertungen anderswo" (external rating facts) for
 * existing products that have none yet. The AI web research only runs at create
 * time, so older products stay empty — this fills them in, one small batch per
 * tap (the AI web search is rate-limited). Run until `remaining` reaches 0.
 *
 * Needs the OpenRouter provider to be active; the local/dummy provider can't
 * web-search and will simply find nothing.
 */
export function RatingsBackfillAdmin(): any {
  const { show } = useToast();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<RatingBackfillReportDto | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const r = await api.admin.backfillRatings();
      setReport(r);
      show(
        `${r.totalFound} Bewertungen für ${r.withRatings}/${r.attempted} Produkte · noch ${r.remaining} offen`,
        r.totalFound > 0 ? 'success' : 'info',
      );
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Backfill fehlgeschlagen.', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[1.0625rem] font-bold text-label">Bewertungen anderswo</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Holt fehlende externe Bewertungen für vorhandene Produkte per KI-Recherche nach.
          </p>
        </div>
        <UiButton size="sm" loading={running} onClick={run}>
          <Sparkles className="mr-1.5 h-4 w-4" strokeWidth={2.2} aria-hidden />
          Bewertungen suchen
        </UiButton>
      </div>

      {report && (
        <UiCard className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <UiPill tone={report.totalFound > 0 ? 'positive' : 'unsure'}>
              {report.totalFound} Bewertungen
            </UiPill>
            <UiPill tone="neutral">
              {report.withRatings}/{report.attempted} Produkte
            </UiPill>
            <UiPill tone="unsure">noch {report.remaining} offen</UiPill>
          </div>
          <ul className="space-y-1.5">
            {report.results.map((r) => (
              <li key={r.productId} className="flex items-center gap-2 text-[0.8125rem]">
                <Globe
                  className={
                    'h-3.5 w-3.5 shrink-0 ' + (r.found > 0 ? 'text-positive-ink' : 'text-faint')
                  }
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-label">{r.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.error
                    ? 'Fehler'
                    : r.cached
                      ? 'Cache aktuell'
                      : `${r.found} Bewertungen · ${r.themes} Themen`}
                </span>
              </li>
            ))}
          </ul>
        </UiCard>
      )}
    </section>
  );
}
