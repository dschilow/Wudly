import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Battery,
  Lightbulb,
  MessagesSquare,
  Minus,
  PackageOpen,
  Sparkles,
  Wind,
} from 'lucide-react';
import type { ExperienceDto, QuestionDto, ShowcaseSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, breadcrumbJsonLd, absoluteUrl } from '@/lib/seo';
import { ShareButton } from '@/components/ShareButton';
import { SignalPanel } from '@/components/SignalPanel';
import { ProductActionBar } from '@/components/ProductActionBar';
import { ProductTabs } from '@/components/ProductTabs';
import { Reveal } from '@/components/motion/Reveal';
import { ScoreTrend } from '@/components/ScoreTrend';
import { Thumb } from '@/components/Thumb';
import { UsageDurationChart } from '@/components/UsageDurationChart';
import { ExperienceCard } from '@/components/ExperienceCard';
import { ExternalRatingsCard } from '@/components/ExternalRatingsCard';
import { QuestionCard } from '@/components/QuestionCard';
import { ShowcaseCard } from '@/components/showcase/ShowcaseCard';
import { LedgerRow } from '@/components/receipt/LedgerRow';
import { EmptyState } from '@/components/states/States';

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
    const early =
      score !== null &&
      product.insights.experienceCount > 0 &&
      product.insights.experienceCount < 20;
    const earlyYes = early
      ? Math.round((score / 100) * Math.max(1, product.insights.ownerCount))
      : 0;
    const description =
      product.insights.aiHeadline ??
      (early
        ? `Frühes Signal: ${earlyYes} von ${product.insights.ownerCount} Besitzern würden es wieder kaufen. Noch zu wenige Daten für einen belastbaren Score.`
        : `Wudly Signal ${score ?? '–'} · ${product.insights.experienceCount} echte Erfahrungen.`);
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

/** Editorial section overline — mono, tracked, uppercase. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mono-data px-1 pb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

/* A neutral icon for "Vorher wissen" rows. We rotate a small, calm icon set so
   the rows feel designed without inventing fake meaning. */
const KNOW_ICONS = [Wind, Battery, Sparkles, Lightbulb];

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;

  let product;
  try {
    product = await api.products.get(id, { next: { revalidate: 20 } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [experiences, questions, showcases] = await Promise.all([
    safe(api.products.experiences(id, { next: { revalidate: 20 } }), [] as ExperienceDto[]),
    safe(api.products.questions(id, { next: { revalidate: 20 } }), [] as QuestionDto[]),
    safe(api.showcase.forProduct(id, { next: { revalidate: 60 } }), [] as ShowcaseSummaryDto[]),
  ]);

  const ins = product.insights;
  const hasData = ins.experienceCount > 0;

  const earlySignal =
    ins.experienceCount > 0 && ins.experienceCount < 20 && ins.rebuyScore !== null;
  const earlyYesCount = earlySignal
    ? Math.round((ins.rebuyScore! / 100) * Math.max(1, ins.ownerCount))
    : 0;
  const signalStrength =
    ins.experienceCount < 20
      ? 'Frühes Signal'
      : ins.experienceCount < 80
        ? 'Erste Tendenz'
        : ins.experienceCount < 250
          ? 'Belastbare Tendenz'
          : 'Starkes Langzeitsignal';

  // One calm context sentence under the stamp.
  const subline =
    ins.rebuyScore === null
      ? 'Noch nicht genug echte Nutzung für ein Urteil.'
      : earlySignal
        ? `${earlyYesCount} von ${ins.ownerCount} Besitzern würden es wieder kaufen.`
        : ins.rebuyScore >= 75
          ? 'würden es nach 6 Monaten wieder kaufen.'
          : ins.rebuyScore >= 50
            ? 'würden es wieder kaufen — die Community ist geteilt.'
            : 'würden es wieder kaufen — viele raten ab.';

  const knowItems = ins.wishKnownHighlights.slice(0, 3);
  const positive = ins.topPositiveAspects.slice(0, 3);
  const negative = ins.topNegativeAspects.slice(0, 3);
  const publicExperiences = experiences.filter((e) => e.isPublic);

  const structuredData = [
    productJsonLd(product),
    breadcrumbJsonLd([
      { name: 'Start', url: absoluteUrl('/') },
      { name: 'Entdecken', url: absoluteUrl('/rankings') },
      { name: product.canonicalName, url: absoluteUrl(`/products/${id}`) },
    ]),
  ];

  /* ── Tab contents ──────────────────────────────────────────────────── */

  const uebersichtTab = (
    <>
      {(product.description || product.specs.length > 0) && (
        <section>
          <SectionTitle>Das Produkt</SectionTitle>
          <div className="card overflow-hidden">
            {product.description && (
              <p
                className={
                  'px-4 py-3.5 text-[0.9375rem] leading-relaxed text-ink-soft ' +
                  (product.specs.length > 0 ? 'hairline' : '')
                }
              >
                {product.description}
              </p>
            )}
            {product.specs.length > 0 && (
              <div className="space-y-2 px-4 py-4">
                {product.specs.map((spec) => (
                  <LedgerRow key={spec.label} label={spec.label} value={spec.value} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {knowItems.length > 0 && (
        <section>
          <SectionTitle>Vorher wissen</SectionTitle>
          <div className="card overflow-hidden">
            {knowItems.map((wish, i) => {
              const Icon = KNOW_ICONS[i % KNOW_ICONS.length]!;
              return (
                <div
                  key={i}
                  className={
                    'flex items-center gap-3 px-4 py-3.5 ' +
                    (i < knowItems.length - 1 ? 'hairline' : '')
                  }
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] bg-accent-soft text-accent-ink">
                    <Icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.1} />
                  </span>
                  <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-label">{wish}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasData && (positive.length > 0 || negative.length > 0) && (
        <section>
          <SectionTitle>Stärken &amp; Kritik</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-positive-ink">
                Stärken
              </p>
              <ul className="mt-3 space-y-2.5">
                {positive.length > 0 ? (
                  positive.map((a) => (
                    <li key={a.key} className="flex items-start gap-2 text-[0.9375rem] text-label">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-positive text-[#f7f5ef]">
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none">
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="leading-snug">{a.label}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[0.9375rem] text-muted-foreground">Noch keine.</li>
                )}
              </ul>
            </div>
            <div className="card p-4">
              <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-regret-ink">
                Kritik
              </p>
              <ul className="mt-3 space-y-2.5">
                {negative.length > 0 ? (
                  negative.map((a) => (
                    <li key={a.key} className="flex items-start gap-2 text-[0.9375rem] text-label">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-regret text-[#f7f5ef]">
                        <Minus className="h-2.5 w-2.5" strokeWidth={4} />
                      </span>
                      <span className="leading-snug">{a.label}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[0.9375rem] text-muted-foreground">Noch keine.</li>
                )}
              </ul>
            </div>
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
                className="press inline-flex h-11 items-center rounded-full bg-accent px-6 text-[1rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]"
              >
                Ich besitze es
              </Link>
            }
          />
        </div>
      )}

      {product.externalRatings.length > 0 && (
        <section>
          <SectionTitle>Bewertungen anderswo</SectionTitle>
          <ExternalRatingsCard ratings={product.externalRatings} />
          <p className="px-1 pt-2 text-[0.8125rem] leading-snug text-muted-foreground">
            Durchschnittswerte externer Plattformen (mit Quelle verlinkt). Sie fließen{' '}
            <span className="font-medium text-label">nicht</span> in das Wudly Signal ein — das
            bleibt zu 100&nbsp;% echte Besitzer.
          </p>
        </section>
      )}

      {hasData && publicExperiences.length >= 3 && (
        <section id="nutzung" className="scroll-mt-24">
          <SectionTitle>Score-Verlauf</SectionTitle>
          <div className="card p-4">
            <ScoreTrend experiences={experiences} />
          </div>
        </section>
      )}

      {hasData && (
        <section>
          <SectionTitle>Nutzungsdauer</SectionTitle>
          <div className="card p-4">
            <UsageDurationChart stats={ins.usageDurationStats} />
          </div>
        </section>
      )}
    </>
  );

  const stimmenTab =
    experiences.length > 0 ? (
      <div className="space-y-3">
        {experiences.map((exp) => (
          <ExperienceCard key={exp.id} experience={exp} />
        ))}
      </div>
    ) : (
      <div className="card">
        <EmptyState
          icon={<PackageOpen className="h-7 w-7" strokeWidth={1.8} />}
          title="Noch keine Stimmen"
          description="Sei der erste Besitzer und teile deine Erfahrung."
        />
      </div>
    );

  const fragenTab = (
    <>
      <div className="flex items-center justify-between px-1">
        <p className="text-[0.9375rem] text-muted-foreground">
          Echte Besitzer antworten — meist innerhalb weniger Tage.
        </p>
        <Link
          href={`/products/${id}/ask`}
          className="tap-dim mono-data shrink-0 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-accent"
        >
          Frage stellen
        </Link>
      </div>
      {questions.length > 0 ? (
        <div className="space-y-3">
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
    </>
  );

  return (
    <div className="animate-fade space-y-5 pb-4 pt-3">
      <JsonLd data={structuredData} />

      {/* 1 · Editorial hero: image beside serif title, mono meta overline */}
      <section className="animate-rise flex items-center gap-4">
        <Thumb
          product={product}
          className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
          rounded="rounded-[1rem]"
        />
        <div className="min-w-0 flex-1">
          <p className="mono-data flex flex-wrap items-center gap-x-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {product.brand && <span>{product.brand}</span>}
            {product.brand && product.category && <span aria-hidden>·</span>}
            {product.category && (
              <Link
                href={`/kategorie/${product.category.slug}`}
                className="tap-dim text-accent-ink"
              >
                {product.category.name}
              </Link>
            )}
          </p>
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <h1 className="font-display text-balance text-[1.9rem] leading-[1.02] text-label">
              {product.canonicalName}
            </h1>
            <ShareButton
              title={`${product.canonicalName} — Würdest du es wieder kaufen?`}
              text={
                ins.aiHeadline ??
                (earlySignal
                  ? `Frühes Signal: ${earlyYesCount} von ${ins.ownerCount} Besitzern würden es wieder kaufen.`
                  : `Wudly Signal ${ins.rebuyScore ?? '–'} auf Wudly`)
              }
            />
          </div>
        </div>
      </section>

      {/* 2 · The Kassenbon — Wudly's verdict artifact */}
      <SignalPanel
        productId={product.id}
        productName={product.canonicalName}
        score={ins.rebuyScore}
        earlySignal={earlySignal}
        earlyYesCount={earlyYesCount}
        ownerCount={ins.ownerCount}
        experienceCount={ins.experienceCount}
        signalStrength={signalStrength}
        subline={subline}
      />

      {earlySignal && (
        <p className="px-1 text-[0.875rem] leading-snug text-muted-foreground">
          Frühes Signal: noch zu wenige Daten für einen belastbaren Score.
        </p>
      )}

      {/* 3 · Tabs keep scroll paths short */}
      <ProductTabs
        tabs={[
          { key: 'uebersicht', label: 'Übersicht', content: uebersichtTab },
          { key: 'stimmen', label: 'Stimmen', count: experiences.length, content: stimmenTab },
          { key: 'fragen', label: 'Fragen', count: questions.length, content: fragenTab },
        ]}
      />

      {/* Wudly Showcase — clearly separated commercial / creator content. */}
      {showcases.length > 0 && (
        <Reveal className="space-y-2.5 pt-2">
          <div className="flex items-center gap-2 px-1 pb-0.5">
            <span className="h-px flex-1 bg-separator" aria-hidden />
            <span className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Wudly Showcase
            </span>
            <span className="h-px flex-1 bg-separator" aria-hidden />
          </div>
          <p className="px-1 text-center text-[0.8125rem] leading-snug text-muted-foreground">
            Hersteller- und Creator-Präsentationen. Klar gekennzeichnet und{' '}
            <span className="font-medium text-label">getrennt vom neutralen Score</span>.
          </p>
          {showcases.map((s) => (
            <ShowcaseCard key={s.id} showcase={s} href={`/showcases/${s.id}`} />
          ))}
        </Reveal>
      )}

      {/* 4 · Sticky action bar — "Fragen" opens the composer as a bottom sheet */}
      <ProductActionBar productId={id} productName={product.canonicalName} />
      <div className="h-20" aria-hidden />
    </div>
  );
}
