import Link from 'next/link';
import { Search, Package, ChevronRight } from 'lucide-react';
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
    <div className="flex items-end justify-between px-1 pb-1.5 pt-0">
      <h2 className="text-[1.375rem] font-bold tracking-tight text-label">{title}</h2>
      {href && (
        <Link href={href} className="tap-dim flex items-center text-[0.9375rem] text-accent">
          Alle
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [topRebuy, mostDiscussed] = await Promise.all([
    safe(api.rankings.topRebuy(4, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.mostDiscussed(3, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
  ]);

  return (
    <div className="animate-fade space-y-8 pt-2">
      {/* Hero — calm, typographic, no decorative chrome */}
      <section className="px-1 pt-2">
        <h1 className="text-balance text-[2.375rem] font-bold leading-[1.08] tracking-[-0.03em] text-label">
          Würdest du es
          <br />
          <span className="text-accent">wieder kaufen?</span>
        </h1>
        <p className="mt-3 max-w-md text-pretty text-[1.0625rem] leading-snug text-muted-foreground">
          Echte Besitzer. Echte Nutzung. Sieh, was sich wirklich lohnt.
        </p>

        <div className="mt-6 space-y-2.5">
          <Link
            href="/check"
            className="tap-dim flex h-[3.125rem] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent text-[1.0625rem] font-semibold text-white"
          >
            <Search className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.4} />
            Produkt prüfen
          </Link>
          <Link
            href="/check?own=1"
            className="tap-dim flex h-[3.125rem] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-fill-2 text-[1.0625rem] font-semibold text-label"
          >
            <Package className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
            Ich besitze ein Produkt
          </Link>
        </div>
      </section>

      {/* Top rebuy */}
      <section>
        <SectionHeader title="Würden sie wieder kaufen" href="/rankings" />
        {topRebuy.length > 0 ? (
          <ProductList products={topRebuy} />
        ) : (
          <EmptyState
            title="Noch keine Daten"
            description="Sei der Erste und teile eine Produkterfahrung."
          />
        )}
      </section>

      {/* Most discussed */}
      {mostDiscussed.length > 0 && (
        <section>
          <SectionHeader title="Am meisten diskutiert" href="/rankings" />
          <ProductList products={mostDiscussed} />
        </section>
      )}

      {/* Closing prompt — a calm grouped row, not a loud banner */}
      <Link
        href="/check?own=1"
        className="tap block overflow-hidden rounded-[var(--radius-lg)] bg-surface"
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Package className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] leading-tight text-label">Erfahrung teilen</div>
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
