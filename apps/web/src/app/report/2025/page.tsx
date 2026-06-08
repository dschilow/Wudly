import Link from 'next/link';
import type { Metadata } from 'next';
import { Flame, Eye, ShieldCheck } from 'lucide-react';
import type { BlindSpotDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductList } from '@/components/ProductList';
import { JsonLd } from '@/components/JsonLd';
import { absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

// Editorial year-in-review. Refresh daily during the year; cheap and crawlable.
export const revalidate = 3600;

const YEAR = 2025;

export const metadata: Metadata = {
  title: `Die größten Kaufenttäuschungen ${YEAR} in Deutschland`,
  description: `Der Wudly Regret-Report ${YEAR}: die meistbereuten Produkte, die blinden Flecken pro Kategorie und was echte Besitzer nach Monaten wirklich denken.`,
  alternates: { canonical: `/report/${YEAR}` },
  openGraph: {
    title: `Wudly Regret-Report ${YEAR}`,
    description: `Die größten Kaufenttäuschungen ${YEAR} — aus echten Besitzererfahrungen.`,
    type: 'article',
    url: `/report/${YEAR}`,
  },
};

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function RegretReportPage() {
  const [regret, blindSpots] = await Promise.all([
    safe(api.rankings.topRegret(10, { next: { revalidate } }), [] as RankingEntryDto[]),
    safe(api.rankings.blindSpots({ next: { revalidate } }), [] as BlindSpotDto[]),
  ]);

  const structuredData = [
    breadcrumbJsonLd([
      { name: 'Start', url: absoluteUrl('/') },
      { name: `Regret-Report ${YEAR}`, url: absoluteUrl(`/report/${YEAR}`) },
    ]),
  ];

  return (
    <article className="animate-fade space-y-8 pb-8 pt-1">
      <JsonLd data={structuredData} />

      {/* Editorial masthead */}
      <header className="px-1 pt-2">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-accent">
          Wudly Regret-Report
        </p>
        <h1 className="mt-2 text-balance text-[2.5rem] font-bold leading-[1.02] tracking-tight text-label">
          Die größten Kaufenttäuschungen {YEAR}
        </h1>
        <p className="mt-3 max-w-[30rem] text-pretty text-[1.0625rem] leading-snug text-muted-foreground">
          Nicht beim Kauf bewertet, sondern nach Monaten echter Nutzung. Das bereuen Käuferinnen und
          Käufer in Deutschland am häufigsten — und das hätten sie vorher gern gewusst.
        </p>
      </header>

      {/* Top regret list */}
      <section>
        <div className="mb-2 flex items-center gap-2 px-1">
          <Flame className="h-[1.1rem] w-[1.1rem] text-regret-ink" strokeWidth={2.4} />
          <h2 className="text-[1.3125rem] font-bold tracking-tight text-label">
            Top 10 der meistbereuten Produkte
          </h2>
        </div>
        {regret.length > 0 ? (
          <ProductList
            products={regret.map((e) => ({ product: e.product, rank: e.rank }))}
            emphasis="regret"
          />
        ) : (
          <p className="card p-4 text-[0.9375rem] text-muted-foreground">
            Sobald genug echte Erfahrungen vorliegen, erscheint hier die Jahres-Auswertung.
          </p>
        )}
      </section>

      {/* Blind spots */}
      {blindSpots.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Eye className="h-[1.1rem] w-[1.1rem] text-unsure-ink" strokeWidth={2.4} />
            <h2 className="text-[1.3125rem] font-bold tracking-tight text-label">
              Die blinden Flecken des Jahres
            </h2>
          </div>
          <div className="space-y-2.5">
            {blindSpots.slice(0, 8).map((b) => (
              <Link
                key={b.category.slug}
                href={`/kategorie/${b.category.slug}`}
                className="card tap block p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.9375rem] font-semibold text-label">
                    {b.category.name}
                  </span>
                  {b.averageRegretScore !== null && (
                    <span className="tnum shrink-0 text-[0.8125rem] font-semibold text-regret-ink">
                      Ø {b.averageRegretScore}% Regret
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
                  „{b.blindSpot}“
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Method + CTA */}
      <section className="card-elevated overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <ShieldCheck className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
            </span>
            <h2 className="text-[1.0625rem] font-bold tracking-tight text-label">
              So entsteht der Report
            </h2>
          </div>
          <p className="mt-3 text-[0.9375rem] leading-snug text-muted-foreground">
            Jede Wertung stammt von echten Besitzern. Längere Nutzung zählt mehr als der erste
            Eindruck — so wird aus Kauflaune ein ehrliches Signal. Frei nutzbar, frei teilbar.
          </p>
          <Link
            href="/check"
            className="press premium-ink mt-4 inline-flex h-[3rem] items-center justify-center rounded-[var(--radius-md)] px-5 text-[1.0625rem] font-semibold"
          >
            Produkt vor dem Kauf prüfen
          </Link>
        </div>
      </section>
    </article>
  );
}
