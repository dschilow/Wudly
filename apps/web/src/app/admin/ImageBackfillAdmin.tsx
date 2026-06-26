'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImageOff, RefreshCw, Sparkles } from 'lucide-react';
import type { ImagelessProductDto, ImageBackfillReportDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
const UiCard = Card as any;
const UiButton = Button as any;
const UiPill = Pill as any;

/** Why a backfill pass couldn't find a photo, in plain German. */
const REASON_LABELS: Record<string, string> = {
  'cse-off': 'Google-Bildsuche aus (CSE-Keys fehlen)',
  'no-candidates': 'Keine Bildkandidaten gefunden',
  'all-candidates-failed': 'Kandidaten luden nicht (HTTP/MIME/Größe)',
  error: 'Fehler beim Suchlauf',
};

/**
 * Admin panel: see which products still have no cached photo ("fehlt warum") and
 * re-run the image hunt for the oldest gaps in small batches. The hunt itself
 * lives on the API (Google CSE → og:image → AI url); here we just trigger it and
 * surface the per-product result so the catalog can be filled in passes.
 */
export function ImageBackfillAdmin(): any {
  const { show } = useToast();
  const [imageless, setImageless] = useState<ImagelessProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState<ImageBackfillReportDto | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    api.admin
      .imagelessProducts({ cache: 'no-store' })
      .then(setImageless)
      .catch(() => setImageless([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const runBackfill = async () => {
    setRunning(true);
    try {
      const report = await api.admin.backfillImages();
      setLastReport(report);
      if (!report.cseConfigured && report.found === 0) {
        show('Google-Bildsuche ist nicht konfiguriert (CSE-Keys).', 'error');
      } else {
        show(
          `${report.found} von ${report.attempted} Bildern gefunden · noch ${report.remaining} offen`,
          report.found > 0 ? 'success' : 'info',
        );
      }
      refresh();
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
          <h2 className="text-[1.0625rem] font-bold text-label">Produktbilder</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {loading
              ? 'Lade …'
              : imageless.length === 0
                ? 'Alle Produkte haben ein Bild.'
                : `${imageless.length}${imageless.length >= 50 ? '+' : ''} Produkte ohne Foto.`}
          </p>
        </div>
        <UiButton
          size="sm"
          loading={running}
          onClick={runBackfill}
          disabled={imageless.length === 0}
        >
          <Sparkles className="mr-1.5 h-4 w-4" strokeWidth={2.2} aria-hidden />
          Bilder nachladen
        </UiButton>
      </div>

      {lastReport && (
        <UiCard className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <UiPill tone={lastReport.found > 0 ? 'positive' : 'unsure'}>
              {lastReport.found}/{lastReport.attempted} gefunden
            </UiPill>
            <UiPill tone="unsure">noch {lastReport.remaining} offen</UiPill>
            {!lastReport.cseConfigured && <UiPill tone="negative">CSE aus</UiPill>}
          </div>
          <ul className="space-y-1.5">
            {lastReport.results.map((r) => (
              <li key={r.productId} className="flex items-center gap-2 text-[0.8125rem]">
                {r.found ? (
                  <span className="shrink-0 text-positive-ink">●</span>
                ) : (
                  <span className="shrink-0 text-faint">○</span>
                )}
                <span className="min-w-0 flex-1 truncate text-label">{r.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.found
                    ? `via ${r.storedVia}`
                    : (r.reason && REASON_LABELS[r.reason]) || 'nicht gefunden'}
                </span>
              </li>
            ))}
          </ul>
        </UiCard>
      )}

      {!loading && imageless.length > 0 && (
        <UiCard className="space-y-1.5">
          {imageless.slice(0, 12).map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[0.8125rem]">
              <ImageOff className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-label">
                {[p.brand, p.canonicalName].filter(Boolean).join(' · ')}
              </span>
              {p.hasStaleImageUrl && <UiPill tone="negative">alter Link</UiPill>}
              <span className="shrink-0 text-muted-foreground">{p.categoryName ?? '—'}</span>
            </div>
          ))}
          {imageless.length > 12 && (
            <p className="pt-1 text-center text-[0.75rem] text-faint">
              + {imageless.length - 12} weitere
            </p>
          )}
        </UiCard>
      )}

      {!loading && imageless.length === 0 && !lastReport && (
        <UiCard className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
          <RefreshCw className="h-4 w-4 text-positive-ink" strokeWidth={2.2} aria-hidden />
          Vollständig — jedes sichtbare Produkt hat ein zwischengespeichertes Foto.
        </UiCard>
      )}
    </section>
  );
}
