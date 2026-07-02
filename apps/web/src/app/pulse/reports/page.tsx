'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PulseReportDto, PulseReportType } from '@wudly/shared';
import { FileText, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import { TrendChip } from '@/components/pulse/atoms';
import { ErrorState, PageSkeleton } from '@/components/states/States';

const REPORTS: Array<{ type: PulseReportType; label: string; hint: string }> = [
  { type: 'health', label: 'Product Health', hint: 'Der wöchentliche Blick: KPIs, Risiken, Lichtblicke.' },
  { type: 'executive', label: 'Executive', hint: 'Drei Sätze fürs Management — Risiken, Fortschritt, Datenbasis.' },
  { type: 'longterm', label: 'Langzeit-Zufriedenheit', hint: 'Wie sich Produkte über die Besitzdauer halten.' },
  { type: 'competition', label: 'Wettbewerb', hint: 'Wo du gewinnst und wo Konkurrenten vorbeiziehen.' },
  { type: 'actions', label: 'Maßnahmen-Wirkung', hint: 'Was deine Maßnahmen messbar verändert haben.' },
];

/**
 * Reports — server-computed management reports with clear German statements.
 * Printable via the browser (Strg+P) — the layout is print-friendly.
 */
export default function PulseReportsPage() {
  const { periodDays } = usePulse();
  const [type, setType] = useState<PulseReportType>('health');
  const [report, setReport] = useState<PulseReportDto | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api.pulse
      .report(type, periodDays, { cache: 'no-store' })
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [type, periodDays]);

  useEffect(load, [load]);

  return (
    <div className="animate-fade space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
            Reports
          </h1>
          <p className="mt-1 text-[0.92rem] text-muted-foreground">
            Keine Diagramm-Friedhöfe — klare Aussagen, direkt aus den Besitzerstimmen berechnet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-4 py-2 text-[0.85rem] font-medium text-label hover:bg-fill"
        >
          <Printer className="h-4 w-4" /> Drucken / PDF
        </button>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
        {REPORTS.map((r) => (
          <button
            key={r.type}
            type="button"
            onClick={() => setType(r.type)}
            className={cn(
              'rounded-[1rem] border p-3 text-left transition-colors',
              type === r.type
                ? 'border-accent bg-accent-soft'
                : 'border-border bg-surface hover:bg-surface-soft',
            )}
          >
            <div className="flex items-center gap-1.5 text-[0.88rem] font-semibold text-label">
              <FileText className={cn('h-4 w-4', type === r.type ? 'text-accent' : 'text-label-3')} />
              {r.label}
            </div>
            <p className="mt-1 text-[0.75rem] leading-snug text-muted-foreground">{r.hint}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : error || !report ? (
        <ErrorState
          description="Report konnte nicht erstellt werden."
          action={
            <button
              type="button"
              onClick={load}
              className="rounded-full bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-foreground"
            >
              Erneut versuchen
            </button>
          }
        />
      ) : (
        <article className="card space-y-6 p-6 md:p-8">
          <header className="border-b border-separator pb-4">
            <div className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-label-3">
              Wudly Pulse ·{' '}
              {new Date(report.generatedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <h2 className="mt-1 font-display text-[1.4rem] font-bold tracking-tight text-label">
              {report.title}
            </h2>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-muted-foreground">
              {report.intro}
            </p>
          </header>

          {report.sections.map((section) => (
            <section key={section.title}>
              <h3 className="text-[1.05rem] font-bold text-label">{section.title}</h3>
              {section.statements.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {section.statements.map((statement, i) => (
                    <li
                      key={i}
                      className="rounded-[0.75rem] bg-fill px-4 py-2.5 text-[0.92rem] leading-relaxed text-label-2"
                    >
                      {statement}
                    </li>
                  ))}
                </ul>
              )}
              {section.metrics.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[0.88rem]">
                    <tbody className="divide-y divide-separator">
                      {section.metrics.map((metric, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-4 text-label-2">{metric.label}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-label tnum">
                            {metric.value}
                          </td>
                          <td className="py-2 text-right">
                            {metric.delta !== undefined && <TrendChip delta={metric.delta ?? null} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          <footer className="border-t border-separator pt-3 text-[0.75rem] text-label-3">
            Alle Werte stammen aus dem neutralen Wudly-Signal (echte Besitzer, echte Nutzung).
            Kommerzielle Inhalte fließen niemals in diese Zahlen ein.
          </footer>
        </article>
      )}
    </div>
  );
}
