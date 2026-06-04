import Link from 'next/link';
import { Search, Package, ChevronRight, Users, Hourglass, ShieldCheck } from 'lucide-react';
import type { RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductList } from '@/components/ProductList';
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
  const [topRebuy, mostDiscussed] = await Promise.all([
    safe(api.rankings.topRebuy(5, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.mostDiscussed(3, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
  ]);

  return (
    <div className="animate-fade space-y-7 pt-2">
      {/* Hero — signature brand gradient, the app's anchor moment */}
      <section className="brand-gradient relative overflow-hidden rounded-[var(--radius-2xl)] px-5 pb-5 pt-6 text-white shadow-[var(--shadow-hero)]">
        {/* soft decorative light */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-8 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-white/70">
            Wudly
          </p>
          <h1 className="mt-2 text-balance text-[2.125rem] font-bold leading-[1.06] tracking-[-0.03em]">
            Würdest du es wieder kaufen?
          </h1>
          <p className="mt-2.5 max-w-[19rem] text-pretty text-[1.0625rem] leading-snug text-white/85">
            Echte Besitzer. Nach echter Nutzung. Sieh, was sich wirklich lohnt.
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <Link
              href="/check"
              className="press flex h-[3.125rem] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-white text-[1.0625rem] font-semibold text-[color:var(--brand-from)] shadow-sm"
            >
              <Search className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.6} />
              Produkt prüfen
            </Link>
            <Link
              href="/check?own=1"
              className="press flex h-[3.125rem] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-white/15 text-[1.0625rem] font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur"
            >
              <Package className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.4} />
              Ich besitze ein Produkt
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip — explains the value, fills with calm rhythm */}
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

      {/* Top rebuy — the leaderboard */}
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

      {/* Most discussed — no medals, it's volume not quality */}
      {mostDiscussed.length > 0 && (
        <section>
          <SectionHeader title="Am meisten diskutiert" href="/rankings" />
          <ProductList products={mostDiscussed.map((e) => e.product)} />
        </section>
      )}

      {/* Closing prompt — a calm, inviting row */}
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
