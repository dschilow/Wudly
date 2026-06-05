import Link from 'next/link';
import {
  Camera,
  ChevronRight,
  Hourglass,
  Package,
  Radar,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductList } from '@/components/ProductList';
import { ScoreRing } from '@/components/ScoreRing';
import { EmptyState } from '@/components/states/States';

export const revalidate = 30;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[1.3125rem] font-bold tracking-tight text-label">{title}</h2>
      {href && (
        <Link
          href={href}
          className="tap-dim flex items-center gap-0.5 text-[0.9375rem] font-medium text-accent"
        >
          Alle
          <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
        </Link>
      )}
    </div>
  );
}

const TRUST = [
  { icon: Users, label: 'Echte Besitzer' },
  { icon: Hourglass, label: 'Nach Nutzung' },
  { icon: ShieldCheck, label: 'Ehrliche Wertung' },
];

export default async function HomePage() {
  const [topRebuy, topRegret, mostDiscussed] = await Promise.all([
    safe(api.rankings.topRebuy(5, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.topRegret(5, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.mostDiscussed(3, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
  ]);

  const heroProduct = topRebuy[0]?.product ?? mostDiscussed[0]?.product;
  const heroScore = heroProduct?.rebuyScore ?? 86;
  const heroOwners = heroProduct?.ownerCount ?? 142;

  return (
    <div className="animate-fade space-y-7 pt-2">
      <section className="card-elevated overflow-hidden ring-1 ring-border">
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Wudly
            </p>
            <h1 className="mt-2 text-balance text-[2.45rem] font-bold leading-[1.02] text-label">
              Würdest du es wieder kaufen?
            </h1>
            <p className="mt-3 max-w-[21rem] text-pretty text-[1.0625rem] leading-snug text-muted-foreground">
              Echte Besitzer. Echte Nutzung. Bessere Käufe.
            </p>

            <div className="mt-5 grid gap-2.5">
              <Link
                href="/check"
                className="press flex h-[3.25rem] items-center justify-center gap-2 rounded-[1rem] bg-ink text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-pop)]"
              >
                <Search className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.5} />
                Produkt prüfen
              </Link>
              <Link
                href="/check?scan=1"
                className="press flex h-[3.125rem] items-center justify-center gap-2 rounded-[1rem] bg-fill-2 text-[1.0625rem] font-semibold text-label"
              >
                <Camera className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.4} />
                Kamera öffnen
              </Link>
            </div>
          </div>

          <div className="relative mx-auto overflow-hidden rounded-[1.5rem] bg-surface-2 px-5 py-4 text-center ring-1 ring-border sm:w-[13.5rem]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-32 w-32 rounded-full bg-[var(--brand-mid)] opacity-[0.10] blur-2xl"
            />
            <div className="relative">
              <ScoreRing score={heroScore} tone="auto" size={156} />
              <p className="mt-3 text-[0.875rem] leading-snug text-muted-foreground">
                {heroProduct ? (
                  <>
                    {heroOwners} Besitzer würden bei{' '}
                    <span className="font-medium text-label">{heroProduct.canonicalName}</span>{' '}
                    wieder ehrlich entscheiden.
                  </>
                ) : (
                  <>Signature-Score: klarer als Sterne, ehrlicher als Kauflaune.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="card flex items-stretch px-1 py-3">
        {TRUST.map((t, i) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className={
                'flex flex-1 flex-col items-center gap-1.5 px-1 ' +
                (i < TRUST.length - 1 ? 'border-r border-separator' : '')
              }
            >
              <Icon className="h-[1.15rem] w-[1.15rem] text-accent" strokeWidth={2.2} />
              <span className="text-center text-[0.75rem] font-medium leading-tight text-muted-foreground">
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      <section>
        <SectionHeader title="Würden sie wieder kaufen" href="/rankings" />
        {topRebuy.length > 0 ? (
          <ProductList products={topRebuy.map((e) => ({ product: e.product, rank: e.rank }))} />
        ) : (
          <div className="card">
            <EmptyState
              title="Noch keine Daten"
              description="Sei der Erste und teile eine Produkterfahrung."
            />
          </div>
        )}
      </section>

      {topRegret.length > 0 && (
        <section>
          <SectionHeader title="Bereuen Besitzer am häufigsten" href="/rankings" />
          <ProductList
            products={topRegret.map((e) => ({ product: e.product, rank: e.rank }))}
            emphasis="regret"
          />
        </section>
      )}

      {mostDiscussed.length > 0 && (
        <section>
          <SectionHeader title="Am meisten diskutiert" href="/rankings" />
          <ProductList products={mostDiscussed.map((e) => e.product)} />
        </section>
      )}

      <Link href="/rankings" className="card press tap block overflow-hidden">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-regret-soft text-regret-ink">
            <Radar className="h-[1.25rem] w-[1.25rem]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium leading-tight text-label">
              Regret-Radar ansehen
            </div>
            <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Kategorien, in denen Käufer am häufigsten danebenliegen.
            </div>
          </div>
          <ChevronRight
            className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
            strokeWidth={2.5}
          />
        </div>
      </Link>

      <Link href="/check?own=1" className="card press tap block overflow-hidden">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Package className="h-[1.25rem] w-[1.25rem]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium leading-tight text-label">
              Teile deine Erfahrung
            </div>
            <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              In unter einer Minute. Hilft anderen beim Kauf.
            </div>
          </div>
          <ChevronRight
            className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
            strokeWidth={2.5}
          />
        </div>
      </Link>
    </div>
  );
}
