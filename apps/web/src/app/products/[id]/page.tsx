import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeftRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  Lightbulb,
  MessagesSquare,
  PackageOpen,
  Quote,
  ShieldCheck,
} from 'lucide-react';
import type { ExperienceDto, QuestionDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { rebuyVerdict } from '@/lib/verdict';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, breadcrumbJsonLd, absoluteUrl } from '@/lib/seo';
import { ShareButton } from '@/components/ShareButton';
import { ScoreRing } from '@/components/ScoreRing';
import { SealBadge } from '@/components/SealBadge';
import { ScoreTrend } from '@/components/ScoreTrend';
import { Thumb } from '@/components/Thumb';
import { AspectList } from '@/components/AspectList';
import { AiInsightCard } from '@/components/AiInsightCard';
import { UsageDurationChart } from '@/components/UsageDurationChart';
import { ExperienceCard } from '@/components/ExperienceCard';
import { QuestionCard } from '@/components/QuestionCard';
import { ProductList } from '@/components/ProductList';
import { Pill } from '@/components/ui/Pill';
import { EmptyState } from '@/components/states/States';
import { HouseholdSwipeDeck } from '@/app/check/HouseholdSwipeDeck';

export const revalidate = 20;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await api.products.get(id, { next: { revalidate: 60 } });
    const score = product.insights.rebuyScore;
    const description =
      product.insights.aiHeadline ??
      `Wiederkauf-Score ${score ?? '–'} · ${product.insights.experienceCount} echte Erfahrungen.`;
    // og:image / twitter:image come from the colocated opengraph-image.tsx (a crisp
    // next/og PNG) — no manual image URL needed here.
    return {
      title: product.canonicalName,
      description,
      alternates: { canonical: `/products/${id}` },
      openGraph: {
        title: `${product.canonicalName} — Würdest du es wieder kaufen?`,
        description,
        type: 'website',
        url: `/products/${id}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${product.canonicalName} — Würdest du es wieder kaufen?`,
        description,
      },
    };
  } catch {
    return { title: 'Produkt' };
  }
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 pb-2 pt-1 text-[1.0625rem] font-bold tracking-tight text-label">
      {children}
    </h2>
  );
}

function Stat({
  value,
  label,
  tone = 'default',
  divider,
}: {
  value: string;
  label: string;
  tone?: 'default' | 'regret' | 'muted';
  divider?: boolean;
}) {
  const color =
    tone === 'regret'
      ? 'var(--color-regret)'
      : tone === 'muted'
        ? 'var(--color-muted-foreground)'
        : 'var(--color-label)';
  return (
    <div className={'px-2 py-3.5 text-center ' + (divider ? 'border-r border-separator' : '')}>
      <div className="text-[1.4rem] font-bold tnum leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[0.75rem] text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;

  let product;
  try {
    product = await api.products.get(id, { next: { revalidate: 20 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [experiences, questions, similar] = await Promise.all([
    safe(api.products.experiences(id, { next: { revalidate: 20 } }), [] as ExperienceDto[]),
    safe(api.products.questions(id, { next: { revalidate: 20 } }), [] as QuestionDto[]),
    safe(api.products.similar(id, { next: { revalidate: 120 } }), [] as ProductSummaryDto[]),
  ]);

  const ins = product.insights;
  const hasData = ins.experienceCount > 0;

  const verdict = rebuyVerdict(ins.rebuyScore);

  const structuredData = [
    productJsonLd(product),
    breadcrumbJsonLd([
      { name: 'Start', url: absoluteUrl('/') },
      { name: 'Charts', url: absoluteUrl('/rankings') },
      { name: product.canonicalName, url: absoluteUrl(`/products/${id}`) },
    ]),
  ];

  return (
    <div className="animate-fade space-y-5 pb-4 pt-1">
      <JsonLd data={structuredData} />
      {/* Header */}
      <header className="flex items-start gap-3.5 px-1 pt-1">
        <Thumb product={product} className="h-16 w-16" rounded="rounded-[0.95rem]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-[1.625rem] font-bold leading-[1.12] tracking-tight text-label">
            {product.canonicalName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.9375rem] text-muted-foreground">
            {product.brand && <span className="font-medium">{product.brand}</span>}
            {product.category && (
              <Link href={`/kategorie/${product.category.slug}`} className="tap-dim">
                <Pill tone="neutral">{product.category.name}</Pill>
              </Link>
            )}
            {ins.wudlySeal && <SealBadge />}
          </div>
        </div>
        <ShareButton
          title={`${product.canonicalName} — Würdest du es wieder kaufen?`}
          text={
            product.insights.aiHeadline ?? `Wiederkauf-Score ${ins.rebuyScore ?? '–'} auf Wudly`
          }
        />
      </header>

      {product.description && (
        <p className="px-1 text-[0.9375rem] leading-snug text-muted-foreground">
          {product.description}
        </p>
      )}

      {product.imageUrl && (
        <section className="overflow-hidden rounded-[1.35rem] bg-surface shadow-[var(--shadow-card)] ring-1 ring-border">
          <Thumb product={product} className="aspect-[16/10] w-full" rounded="rounded-[1.35rem]" />
        </section>
      )}

      <section className="card-elevated relative overflow-hidden">
        {/* Verdict-tinted light behind the score — the page's signature moment. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-12 mx-auto h-48 w-48 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: verdict.color }}
        />
        <div className="relative px-5 pb-5 pt-7 text-center">
          <ScoreRing score={ins.rebuyScore} tone="auto" size={188} className="mx-auto" celebrate />
          <div className="animate-rise" style={{ animationDelay: '0.45s' }}>
            <div
              className="mt-4 text-[0.75rem] font-semibold uppercase tracking-[0.08em]"
              style={{ color: verdict.ink }}
            >
              Wiederkauf-Score
            </div>
            <h2 className="mx-auto mt-1 max-w-[20rem] text-balance text-[1.75rem] font-bold leading-[1.06] tracking-tight text-label">
              {verdict.label}
            </h2>
          </div>
          {hasData && ins.rebuyScore !== null ? (
            <p className="mx-auto mt-2 max-w-[21rem] text-[0.9375rem] leading-snug text-muted-foreground">
              {ins.rebuyScore}% von {ins.ownerCount} Besitzer
              {ins.ownerCount === 1 ? '' : 'n'} würden es wieder kaufen.
            </p>
          ) : (
            <p className="mx-auto mt-2 max-w-[21rem] text-[0.9375rem] leading-snug text-muted-foreground">
              Noch nicht genug echte Nutzung für ein belastbares Signal.
            </p>
          )}
        </div>
        <div className="relative grid grid-cols-3 border-t border-separator">
          <Stat
            value={ins.regretScore === null ? '–' : `${ins.regretScore}%`}
            label="Regret"
            tone={ins.regretScore !== null && ins.regretScore >= 40 ? 'regret' : 'muted'}
            divider
          />
          <Stat value={String(ins.experienceCount)} label="Erfahrungen" divider />
          <Stat value={String(ins.ownerCount)} label="Besitzer" />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: BadgeCheck, label: 'Echte Käufer' },
          { icon: Clock3, label: 'Nach Nutzung' },
          { icon: ShieldCheck, label: 'Gewichtet' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[0.9rem] bg-fill-2 px-2 py-3 text-center text-muted-foreground"
            >
              <Icon className="mx-auto h-5 w-5 text-accent" strokeWidth={2.2} />
              <div className="mt-1.5 text-[0.75rem] font-medium leading-tight">{item.label}</div>
            </div>
          );
        })}
      </div>

      {/* Trust transparency — the honesty model is Wudly's edge, so explain it. */}
      <details className="group -mt-2 px-1">
        <summary className="tap-dim flex cursor-pointer list-none items-center gap-1 text-[0.8125rem] font-medium text-accent [&::-webkit-details-marker]:hidden">
          Wie Wudly wertet
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
            strokeWidth={2.6}
            aria-hidden
          />
        </summary>
        <div className="mt-2 rounded-[0.9rem] bg-fill-2 p-3.5 text-[0.8125rem] leading-snug text-muted-foreground">
          <p className="text-label">
            Nicht jede Stimme zählt gleich — ehrliche Signale wiegen mehr:
          </p>
          <ul className="mt-2 space-y-1.5">
            {[
              'Per Kamera oder Barcode verifizierte Käufer zählen voll.',
              'Längere Nutzung wiegt mehr als der erste Eindruck.',
              'Generische oder anonyme Beiträge zählen bewusst weniger.',
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-accent" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* AI summary */}
      {ins.aiHeadline && <AiInsightCard headline={ins.aiHeadline} />}

      {/* The unique data treasure — surfaced high, given a signature treatment. */}
      {ins.wishKnownHighlights.length > 0 && (
        <section className="card-elevated relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent-soft blur-2xl"
          />
          <div className="relative p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Lightbulb className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent-ink">
                  Wudly-Datenschatz
                </p>
                <h2 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-label">
                  Das hätten Besitzer vorher gern gewusst
                </h2>
              </div>
            </div>
            <ul className="mt-3.5 space-y-3">
              {ins.wishKnownHighlights.map((wish, i) => (
                <li key={i} className="flex gap-2.5">
                  <Quote
                    className="mt-0.5 h-[0.95rem] w-[0.95rem] shrink-0 -scale-x-100 text-accent/55"
                    strokeWidth={2.4}
                    aria-hidden
                  />
                  <p className="text-[0.9375rem] leading-snug text-label">{wish}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Comparative regret — "would rather have bought X" */}
      {hasData && ins.insteadOfShare > 0 && ins.insteadOfHighlights.length > 0 && (
        <section className="card-elevated overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-unsure-soft text-unsure-ink">
                <ArrowLeftRight className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-unsure-ink">
                  Komparative Reue
                </p>
                <h2 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-label">
                  {ins.insteadOfShare}% hätten lieber etwas anderes gekauft
                </h2>
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {ins.insteadOfHighlights.map((alt, i) => (
                <li key={i}>
                  <Link
                    href={`/check?q=${encodeURIComponent(alt)}`}
                    className="tap-dim inline-flex items-center gap-1 rounded-full bg-fill-2 px-3 py-1.5 text-[0.875rem] font-medium text-label"
                  >
                    {alt}
                    <ChevronDown
                      className="-mr-0.5 h-3.5 w-3.5 -rotate-90 text-label-3"
                      strokeWidth={2.6}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {!hasData && (
        <div className="card">
          <EmptyState
            icon={<PackageOpen className="h-7 w-7" strokeWidth={1.8} />}
            title="Noch keine Erfahrungen"
            description="Sei der erste Besitzer und teile, ob du es wieder kaufen würdest."
            action={
              <Link
                href={`/products/${id}/own`}
                className="press inline-flex h-11 items-center rounded-[var(--radius-md)] bg-accent px-5 text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
              >
                Ich besitze es
              </Link>
            }
          />
        </div>
      )}

      {/* Strengths & problems */}
      {hasData && (ins.topPositiveAspects.length > 0 || ins.topNegativeAspects.length > 0) && (
        <div className="space-y-4">
          {ins.topPositiveAspects.length > 0 && (
            <section>
              <GroupTitle>Stärken</GroupTitle>
              <div className="card p-4">
                <AspectList title="" aspects={ins.topPositiveAspects} tone="positive" />
              </div>
            </section>
          )}
          {ins.topNegativeAspects.length > 0 && (
            <section>
              <GroupTitle>Probleme</GroupTitle>
              <div className="card p-4">
                <AspectList title="" aspects={ins.topNegativeAspects} tone="negative" />
              </div>
            </section>
          )}
        </div>
      )}

      {/* Audience */}
      {hasData && (ins.suitedFor.length > 0 || ins.notSuitedFor.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {ins.suitedFor.length > 0 && (
            <section>
              <GroupTitle>Geeignet für</GroupTitle>
              <ul className="space-y-2 card p-4 text-[0.9375rem] text-label">
                {ins.suitedFor.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {ins.notSuitedFor.length > 0 && (
            <section>
              <GroupTitle>Eher nicht für</GroupTitle>
              <ul className="space-y-2 card p-4 text-[0.9375rem] text-label">
                {ins.notSuitedFor.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-regret" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Score over time */}
      {hasData && experiences.filter((e) => e.isPublic).length >= 3 && (
        <section>
          <GroupTitle>Score-Verlauf</GroupTitle>
          <div className="card p-4">
            <ScoreTrend experiences={experiences} />
          </div>
        </section>
      )}

      {/* Usage duration */}
      {hasData && (
        <section>
          <GroupTitle>Wie lange im Einsatz</GroupTitle>
          <div className="card p-4">
            <UsageDurationChart stats={ins.usageDurationStats} />
          </div>
        </section>
      )}

      {/* Questions */}
      <section>
        <div className="flex items-end justify-between px-1 pb-1.5">
          <GroupTitle>Fragen an Besitzer</GroupTitle>
          <Link href={`/products/${id}/ask`} className="tap-dim pb-1 text-[0.9375rem] text-accent">
            Frage stellen
          </Link>
        </div>
        {questions.length > 0 ? (
          <div className="space-y-2.5">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={<MessagesSquare className="h-7 w-7" strokeWidth={1.8} />}
              title="Noch keine Fragen"
              description="Stell den Besitzern, was dich wirklich interessiert."
            />
          </div>
        )}
      </section>

      {/* Recent experiences */}
      {experiences.length > 0 && (
        <section>
          <GroupTitle>Echte Erfahrungen · {experiences.length}</GroupTitle>
          <div className="space-y-2.5">
            {experiences.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        </section>
      )}

      {/* Similar products — compare & discover alternatives */}
      {similar.length > 0 && <HouseholdSwipeDeck products={similar} />}

      {similar.length > 0 && (
        <section>
          <div className="flex items-end justify-between px-1 pb-1.5">
            <GroupTitle>Ähnliche Produkte</GroupTitle>
            <Link href="/compare" className="tap-dim pb-1 text-[0.9375rem] text-accent">
              Vergleichen
            </Link>
          </div>
          <ProductList products={similar} />
        </section>
      )}

      {/* Sticky action bar (iOS bottom toolbar, material) */}
      <div className="safe-bottom fixed inset-x-0 bottom-[3.75rem] z-30 border-t border-separator bg-canvas/80 px-5 py-2.5 backdrop-blur-2xl backdrop-saturate-150 md:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Link
            href={`/products/${id}/own`}
            className="press flex h-[2.875rem] flex-1 items-center justify-center rounded-[var(--radius-md)] bg-accent text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
          >
            Ich besitze es
          </Link>
          <Link
            href={`/products/${id}/ask`}
            className="press flex h-[2.875rem] flex-1 items-center justify-center rounded-[var(--radius-md)] bg-fill-2 text-[1.0625rem] font-semibold text-label"
          >
            Besitzer fragen
          </Link>
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </div>
  );
}
