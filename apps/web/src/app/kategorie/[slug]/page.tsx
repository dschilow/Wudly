import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Lightbulb, ShieldCheck, ThumbsUp } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ProductList } from '@/components/ProductList';
import { JsonLd } from '@/components/JsonLd';
import { EmptyState } from '@/components/states/States';
import { breadcrumbJsonLd, itemListJsonLd, absoluteUrl } from '@/lib/seo';

export const revalidate = 120;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

/** Pre-render the known categories at build time; others render on demand. */
export async function generateStaticParams() {
  const categories = await safe(api.categories.list(), []);
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await api.rankings.categoryOverview(slug, { next: { revalidate: 300 } });
    const title = `${data.category.name} — was echte Besitzer nach Monaten wirklich denken`;
    const description =
      `Wiederkauf-Score, häufigste Probleme und Top-Empfehlungen für ${data.category.name}. ` +
      `${data.productCount} Produkte, echte Erfahrungen nach echter Nutzung.`;
    return {
      title,
      description,
      alternates: { canonical: `/kategorie/${slug}` },
      openGraph: {
        title: `${title} · Wudly`,
        description,
        type: 'website',
        url: `/kategorie/${slug}`,
      },
    };
  } catch {
    return { title: 'Kategorie' };
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 pb-2 pt-1 text-[1.0625rem] font-bold tracking-tight text-label">
      {children}
    </h2>
  );
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;

  let data;
  try {
    data = await api.rankings.categoryOverview(slug, { next: { revalidate: 120 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { category, productCount, averageRebuyScore, top, flops, sealCount, blindSpot } = data;

  const structuredData = [
    breadcrumbJsonLd([
      { name: 'Start', url: absoluteUrl('/') },
      { name: 'Charts', url: absoluteUrl('/rankings') },
      { name: category.name, url: absoluteUrl(`/kategorie/${slug}`) },
    ]),
    ...(top.length > 0 ? [itemListJsonLd(`Top ${category.name}`, top)] : []),
  ];

  return (
    <div className="animate-fade space-y-6 pb-6 pt-1">
      <JsonLd data={structuredData} />

      {/* Hero */}
      <header className="px-1 pt-1">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Kategorie
        </p>
        <h1 className="mt-1 text-balance text-[2rem] font-bold leading-[1.05] tracking-tight text-label">
          {category.name}
        </h1>
        <p className="mt-2 max-w-[24rem] text-[1.0625rem] leading-snug text-muted-foreground">
          Was echte Besitzer nach Monaten wirklich denken — nicht beim Kauf, sondern nach der
          Nutzung.
        </p>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[0.9rem] bg-fill-2 px-2 py-3.5 text-center">
          <div className="text-[1.4rem] font-bold tnum leading-none text-label">
            {averageRebuyScore === null ? '–' : `${averageRebuyScore}%`}
          </div>
          <div className="mt-1 text-[0.75rem] text-muted-foreground">Ø Wiederkauf</div>
        </div>
        <div className="rounded-[0.9rem] bg-fill-2 px-2 py-3.5 text-center">
          <div className="text-[1.4rem] font-bold tnum leading-none text-label">{productCount}</div>
          <div className="mt-1 text-[0.75rem] text-muted-foreground">Produkte</div>
        </div>
        <div className="rounded-[0.9rem] bg-fill-2 px-2 py-3.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[1.4rem] font-bold tnum leading-none text-label">
            <ShieldCheck className="h-5 w-5 text-positive" strokeWidth={2.3} />
            {sealCount}
          </div>
          <div className="mt-1 text-[0.75rem] text-muted-foreground">Empfohlen</div>
        </div>
      </div>

      {/* Blind spot */}
      {blindSpot && (
        <section className="card-elevated relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-regret-soft blur-2xl"
          />
          <div className="relative p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-regret-soft text-regret-ink">
                <Lightbulb className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-regret-ink">
                  Blinder Fleck
                </p>
                <h2 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-label">
                  Das wissen viele vorher nicht
                </h2>
              </div>
            </div>
            <p className="mt-3 text-[0.9375rem] leading-snug text-label">„{blindSpot}“</p>
          </div>
        </section>
      )}

      {/* Top */}
      <section>
        <SectionTitle>Würden sie wieder kaufen</SectionTitle>
        {top.length > 0 ? (
          <ProductList products={top} ranked />
        ) : (
          <div className="card">
            <EmptyState
              icon={<ThumbsUp className="h-7 w-7" strokeWidth={1.8} />}
              title="Noch keine Daten"
              description="Sei der Erste und teile eine Erfahrung in dieser Kategorie."
            />
          </div>
        )}
      </section>

      {/* Flops */}
      {flops.length > 0 && (
        <section>
          <SectionTitle>Bereuen Besitzer am häufigsten</SectionTitle>
          <ProductList products={flops} emphasis="regret" />
        </section>
      )}

      <Link href="/rankings" className="card press tap block overflow-hidden">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium leading-tight text-label">
              Alle Kategorien im Regret-Radar
            </div>
            <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Wo Käufer am häufigsten danebenliegen.
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
