'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, CircleAlert, Clock3, ExternalLink, ShieldCheck } from 'lucide-react';
import type { CatalogQualityOverviewDto, FunnelOverviewDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';

export function EnterpriseAdmin() {
  const { show } = useToast();
  const [quality, setQuality] = useState<CatalogQualityOverviewDto | null>(null);
  const [funnel, setFunnel] = useState<FunnelOverviewDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    const [qualityResult, funnelResult] = await Promise.all([
      api.admin.catalogQuality({ cache: 'no-store' }),
      api.admin.funnel(14, { cache: 'no-store' }),
    ]);
    setQuality(qualityResult);
    setFunnel(funnelResult);
  };

  useEffect(() => {
    void refresh().catch(() => {
      setQuality(null);
      setFunnel(null);
    });
  }, []);

  const act = async (id: string, action: 'publish' | 'hold' | 'hide') => {
    if (
      action === 'hide' &&
      !window.confirm('Produkt wirklich aus allen öffentlichen Ansichten ausblenden?')
    ) {
      return;
    }
    setBusyId(id);
    try {
      if (action === 'publish') await api.admin.publishProduct(id);
      if (action === 'hold') await api.admin.holdProduct(id);
      if (action === 'hide') await api.admin.hideProduct(id);
      await refresh();
      show(
        action === 'publish'
          ? 'Produkt veröffentlicht.'
          : action === 'hold'
            ? 'Produkt zur Prüfung zurückgestellt.'
            : 'Produkt ausgeblendet.',
        'success',
      );
    } catch (error) {
      show(error instanceof ApiError ? error.displayMessage : 'Aktion fehlgeschlagen.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="enterprise-quality-title">
      <div className="px-1 pt-2">
        <h2
          id="enterprise-quality-title"
          className="text-[1.3rem] font-bold tracking-tight text-label"
        >
          Plattformqualität
        </h2>
        <p className="text-[0.875rem] text-muted-foreground">
          Recherche-Gates, Kataloglücken und der anonyme 14-Tage-Funnel.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          label="Qualität"
          value={quality ? `${quality.averageScore}/100` : '–'}
        />
        <Metric
          icon={<Clock3 className="h-4 w-4" aria-hidden />}
          label="In Prüfung"
          value={quality?.pendingProducts ?? '–'}
        />
        <Metric
          icon={<CircleAlert className="h-4 w-4" aria-hidden />}
          label="Kritisch"
          value={quality?.criticalProducts ?? '–'}
        />
        <Metric
          icon={<Activity className="h-4 w-4" aria-hidden />}
          label="Recherche → Treffer"
          value={percent(funnel?.ratios.researchSuccess)}
        />
      </div>

      {funnel && (
        <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FunnelStat label="Suchen" value={funnel.totals.SEARCH_PERFORMED} />
          <FunnelStat label="Recherchen" value={funnel.totals.RESEARCH_STARTED} />
          <FunnelStat label="Neue Besitzer" value={funnel.totals.OWNERSHIP_CREATED} />
          <FunnelStat label="Erfahrungen" value={funnel.totals.EXPERIENCE_CREATED} />
          <FunnelStat label="Fragen" value={funnel.totals.QUESTION_CREATED} />
          <FunnelStat label="Antworten" value={funnel.totals.ANSWER_CREATED} />
          <FunnelStat label="Treffer → Besitz" value={percent(funnel.ratios.researchToOwnership)} />
          <FunnelStat label="Frage → Antwort" value={percent(funnel.ratios.questionToAnswer)} />
          <p className="col-span-2 text-[0.75rem] leading-snug text-muted-foreground sm:col-span-4">
            Reine Tageszähler ohne Nutzer-, Session-, IP-, Such- oder Produktkennung. Quoten zeigen
            Ereignisverhältnisse, keine Unique-User-Conversion.
          </p>
        </Card>
      )}

      {quality && quality.items.length > 0 && (
        <div className="space-y-2">
          {quality.items.slice(0, 30).map((item) => (
            <Card key={item.productId} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/products/${item.productId}`}
                    className="inline-flex items-center gap-1 font-semibold text-label hover:text-accent"
                  >
                    <span className="truncate">{item.canonicalName}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.sourceCount} Quellen · {item.experienceCount} Erfahrungen
                  </p>
                </div>
                <Pill tone={item.publishReady ? 'positive' : 'negative'}>{item.score}/100</Pill>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Pill tone={item.status === 'PENDING_REVIEW' ? 'unsure' : 'neutral'}>
                  {item.status === 'PENDING_REVIEW' ? 'In Prüfung' : 'Aktiv'}
                </Pill>
                {item.issues.map((issue) => (
                  <Pill
                    key={issue.code}
                    tone={issue.severity === 'CRITICAL' ? 'negative' : 'neutral'}
                  >
                    {issue.label}
                  </Pill>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {item.status === 'PENDING_REVIEW' && (
                  <Button
                    size="sm"
                    disabled={!item.publishReady}
                    loading={busyId === item.productId}
                    onClick={() => act(item.productId, 'publish')}
                  >
                    Veröffentlichen
                  </Button>
                )}
                {item.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === item.productId}
                    onClick={() => act(item.productId, 'hold')}
                  >
                    Prüfen
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="plain"
                  disabled={busyId === item.productId}
                  onClick={() => act(item.productId, 'hide')}
                >
                  Ausblenden
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="space-y-2">
      <span className="text-accent-ink">{icon}</span>
      <p className="font-display text-[1.55rem] leading-none text-label">{value}</p>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
    </Card>
  );
}

function FunnelStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-[1.35rem] leading-none text-label">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function percent(value: number | null | undefined): string {
  return value == null ? '–' : `${value.toLocaleString('de-DE')}%`;
}
