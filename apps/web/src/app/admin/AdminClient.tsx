'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MergeCandidateDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeftRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { LoadingState, EmptyState } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { ExternalRatingsAdmin } from './ExternalRatingsAdmin';
import { ImageBackfillAdmin } from './ImageBackfillAdmin';
import { RatingsBackfillAdmin } from './RatingsBackfillAdmin';
import { ProductCurationAdmin } from './ProductCurationAdmin';

export function AdminClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { show } = useToast();
  const [candidates, setCandidates] = useState<MergeCandidateDto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    api.admin
      .mergeCandidates({ cache: 'no-store' })
      .then(setCandidates)
      .catch(() => setCandidates([]))
      .finally(() => setDataLoading(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/admin');
      return;
    }
    if (user.role !== 'ADMIN') {
      setDataLoading(false);
      return;
    }
    refresh();
  }, [user, loading, router]);

  if (loading || dataLoading) return <LoadingState />;
  if (!user) return null;

  if (user.role !== 'ADMIN') {
    return (
      <EmptyState
        title="Kein Zugriff"
        description="Dieser Bereich ist nur für Administratoren."
        action={
          <Link
            href="/"
            className="press inline-flex h-11 items-center justify-center rounded-[var(--radius-lg)] bg-fill-2 px-5 text-[1rem] font-semibold text-label transition active:opacity-70"
          >
            Zur Startseite
          </Link>
        }
      />
    );
  }

  const act = async (id: string, action: 'merge' | 'reject') => {
    setBusyId(id);
    try {
      if (action === 'merge') {
        await api.admin.merge(id);
        show('Produkte zusammengeführt ✓', 'success');
      } else {
        await api.admin.reject(id);
        show('Kandidat abgelehnt', 'info');
      }
      setCandidates((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Aktion fehlgeschlagen.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade space-y-4 pt-2">
      <LargeTitle title="Admin" subtitle="Katalogpflege, Duplikate und Backfills." />

      <ProductCurationAdmin />

      <div className="px-1 pt-2">
        <h2 className="text-[1.3rem] font-bold tracking-tight text-label">Merge-Kandidaten</h2>
        <p className="text-[0.875rem] text-muted-foreground">Mögliche doppelte Produkte.</p>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-surface">
          <EmptyState
            title="Keine offenen Kandidaten"
            description="Aktuell gibt es keine möglichen Produkt-Duplikate zu prüfen."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <Card key={c.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Pill tone="unsure">Ähnlichkeit {(c.score * 100).toFixed(0)}%</Pill>
                <span className="text-xs text-muted-foreground">{c.status}</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Link
                  href={`/products/${c.productA.id}`}
                  className="rounded-2xl bg-surface-sunken p-3 text-sm"
                >
                  <div className="font-bold text-ink">{c.productA.canonicalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.productA.experienceCount} Erf. · behält Daten
                  </div>
                </Link>
                <ArrowLeftRight
                  className="mx-auto h-4 w-4 text-faint"
                  strokeWidth={2}
                  aria-hidden
                />
                <Link
                  href={`/products/${c.productB.id}`}
                  className="rounded-2xl bg-surface-sunken p-3 text-sm"
                >
                  <div className="font-bold text-ink">{c.productB.canonicalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.productB.experienceCount} Erf. · wird verschoben
                  </div>
                </Link>
              </div>

              {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={busyId === c.id}
                  onClick={() => act(c.id, 'merge')}
                  className="flex-1"
                >
                  Zusammenführen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === c.id}
                  onClick={() => act(c.id, 'reject')}
                  className="flex-1"
                >
                  Ablehnen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ImageBackfillAdmin />

      <RatingsBackfillAdmin />

      <ExternalRatingsAdmin />
    </div>
  );
}
