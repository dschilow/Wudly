import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, GitCompareArrows, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ComparePairDto, ProductDetailDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { productThumbUrl } from '@/lib/product-media';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  comparePairPath,
  compareIdsFromSlug,
  productJsonLd,
  productPath,
} from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { ScoreRing } from '@/components/ScoreRing';

export const revalidate = 300;

/**
 * Pre-render the strongest head-to-head pairings at build time — "X vs Y" is a
 * huge, high-intent search pattern this app didn't capture before. Any other
 * pairing still resolves on demand (dynamicParams stays default true) and is
 * then cached, exactly like the product SSG warm-start list.
 */
export async function generateStaticParams() {
  try {
    const pairs = await api.products.comparePairs(60);
    return pairs.map((pair) => ({ slug: comparePairPath(pair).replace('/vergleich/', '') }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function loadPair(slug: string): Promise<{ a: ProductDetailDto; b: ProductDetailDto } | null> {
  const ids = compareIdsFromSlug(slug);
  if (!ids) return null;
  const [a, b] = await Promise.all([
    api.products.get(ids[0], { next: { revalidate: 300 } }),
    api.products.get(ids[1], { next: { revalidate: 300 } }),
  ]);
  return { a, b };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const pair = await loadPair(slug);
    if (!pair) return { title: 'Produktvergleich' };
    const title = `${pair.a.canonicalName} vs. ${pair.b.canonicalName}: Der Vergleich`;
    const description = `${pair.a.canonicalName} oder ${pair.b.canonicalName}? Echte Besitzerstimmen, Wiederkauf-Score und Regret-Risiko im direkten Vergleich — auf einen Blick.`;
    const canonicalPath = comparePairPath({
      a: pair.a,
      b: pair.b,
      categoryName: pair.a.category?.name ?? null,
    } as ComparePairDto);
    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: { title, description, type: 'article', url: canonicalPath },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return { title: 'Produktvergleich' };
  }
}

function pct(value: number | null): string {
  return value === null ? 'Offen' : `${value}%`;
}

function getRebuy(product: ProductDetailDto): number | null {
  return product.insights.rebuyScore ?? product.rebuyScore;
}

function getRegret(product: ProductDetailDto): number | null {
  return product.insights.regretScore ?? product.regretScore;
}

export default async function ComparePairPage({ params }: PageProps) {
  const { slug } = await params;

  let pair: { a: ProductDetailDto; b: ProductDetailDto };
  try {
    const loaded = await loadPair(slug);
    if (!loaded) notFound();
    pair = loaded;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { a, b } = pair;
  const canonicalPath = comparePairPath({
    a,
    b,
    categoryName: a.category?.name ?? null,
  } as ComparePairDto);
  if (canonicalPath !== `/vergleich/${slug}`) redirect(canonicalPath);

  const rebuyA = getRebuy(a);
  const rebuyB = getRebuy(b);
  const leaderIsA = rebuyA !== null && rebuyB !== null ? rebuyA >= rebuyB : rebuyA !== null;
  const leader = rebuyA !== null || rebuyB !== null ? (leaderIsA ? a : b) : null;
  const gap = rebuyA !== null && rebuyB !== null ? Math.abs(rebuyA - rebuyB) : null;

  const structuredData = [
    productJsonLd(a),
    productJsonLd(b),
    breadcrumbJsonLd([
      { name: 'Start', url: absoluteUrl('/') },
      { name: 'Vergleichen', url: absoluteUrl('/compare') },
      { name: `${a.canonicalName} vs. ${b.canonicalName}`, url: absoluteUrl(canonicalPath) },
    ]),
  ];

  return (
    <div className="animate-fade mx-auto max-w-3xl space-y-6 pb-10 pt-3">
      <JsonLd data={structuredData} />

      <section>
        <p className="mono-data inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
          <GitCompareArrows className="h-4 w-4" strokeWidth={2.3} />
          Wudly Vergleich
        </p>
        <h1 className="font-display mt-3 text-balance text-[2rem] leading-[1.03] text-label sm:text-[2.5rem]">
          {a.canonicalName} vs. {b.canonicalName}
        </h1>
        <p className="mt-2 max-w-xl text-[1rem] leading-relaxed text-muted-foreground">
          Echte Besitzerstimmen, Wiederkauf-Score und Regret-Risiko im direkten Vergleich.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {[a, b].map((product) => {
          const rebuy = getRebuy(product);
          const regret = getRegret(product);
          const isLeader = leader?.id === product.id && gap !== null && gap >= 3;
          return (
            <Link
              key={product.id}
              href={productPath(product)}
              className="card-elevated block p-4"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productThumbUrl(product)}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-[0.8rem] bg-surface-muted object-contain p-1 ring-1 ring-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] text-muted-foreground">
                    {[product.brand, product.category?.name].filter(Boolean).join(' · ') || 'Produkt'}
                  </p>
                  <p className="line-clamp-2 text-[1.0625rem] font-semibold leading-tight text-label">
                    {product.canonicalName}
                  </p>
                </div>
                <ScoreRing score={rebuy} size={54} animate={false} />
              </div>
              {isLeader && (
                <span className="mono-data mt-3 inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-positive-ink">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Stärkeres Signal
                </span>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-2 text-[0.875rem]">
                <div className="rounded-[0.7rem] bg-fill px-3 py-2">
                  <dt className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Wiederkauf
                  </dt>
                  <dd className="mt-0.5 font-display text-[1.25rem] leading-none text-label">{pct(rebuy)}</dd>
                </div>
                <div className="rounded-[0.7rem] bg-fill px-3 py-2">
                  <dt className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Regret
                  </dt>
                  <dd className="mt-0.5 font-display text-[1.25rem] leading-none text-label">{pct(regret)}</dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {[a, b].map((product) => (
          <div key={product.id} className="card p-4">
            <p className="line-clamp-1 text-[0.9375rem] font-semibold text-label">
              {product.canonicalName}
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mono-data flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-positive-ink">
                  <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2.3} />
                  Stärken
                </p>
                <ul className="mt-1.5 space-y-1">
                  {product.insights.topPositiveAspects.slice(0, 3).map((aspect) => (
                    <li key={aspect.key} className="text-[0.875rem] leading-snug text-label">
                      {aspect.label}
                    </li>
                  ))}
                  {product.insights.topPositiveAspects.length === 0 && (
                    <li className="text-[0.875rem] text-faint">Noch keine klaren Stärken.</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="mono-data flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-regret-ink">
                  <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2.3} />
                  Kritik
                </p>
                <ul className="mt-1.5 space-y-1">
                  {product.insights.topNegativeAspects.slice(0, 3).map((aspect) => (
                    <li key={aspect.key} className="text-[0.875rem] leading-snug text-label">
                      {aspect.label}
                    </li>
                  ))}
                  {product.insights.topNegativeAspects.length === 0 && (
                    <li className="text-[0.875rem] text-faint">Noch keine klare Kritik.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card-elevated flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[1.0625rem] font-semibold text-label">
            Specs, Entscheidungsmodell und Netz-Konsens im Detail
          </p>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">
            Öffne den vollständigen, interaktiven Vergleich mit Entscheidungsmatrix.
          </p>
        </div>
        <Link
          href={`/compare?ids=${a.id},${b.id}`}
          className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-[0.9375rem] font-semibold text-primary-foreground"
        >
          <GitCompareArrows className="h-4 w-4" strokeWidth={2.4} />
          Vollständiger Vergleich
        </Link>
      </section>
    </div>
  );
}
