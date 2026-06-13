import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Battery,
  BadgeCheck,
  Bolt,
  Lightbulb,
  MessagesSquare,
  Minus,
  PackageOpen,
  ScanBarcode,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  UsersRound,
  Wind,
} from 'lucide-react';
import type {
  AspectStatDto,
  ExperienceDto,
  ProductInsightsDto,
  QuestionDto,
  ShowcaseSummaryDto,
} from '@wudly/shared';
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
import { AiInsightCard } from '@/components/AiInsightCard';
import { QuestionCard } from '@/components/QuestionCard';
import { ShowcaseCard } from '@/components/showcase/ShowcaseCard';
import { LedgerRow } from '@/components/receipt/LedgerRow';
import { SealBadge } from '@/components/SealBadge';
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
        ? `Signal im Aufbau: ${earlyYes} von ${product.insights.ownerCount} Besitzern würden es wieder kaufen. Noch zu wenige Daten für einen belastbaren Score.`
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

function DecisionBrief({
  insights,
  positive,
  negative,
  knowItems,
}: {
  insights: ProductInsightsDto;
  positive: AspectStatDto[];
  negative: AspectStatDto[];
  knowItems: string[];
}) {
  const buyItems =
    insights.suitedFor.length > 0
      ? insights.suitedFor
      : positive.map((a) => `Wenn dir ${a.label.toLowerCase()} wichtig ist`).slice(0, 3);
  const avoidItems =
    insights.notSuitedFor.length > 0
      ? insights.notSuitedFor
      : negative.map((a) => `Wenn dich ${a.label.toLowerCase()} stark stört`).slice(0, 3);
  const questions =
    knowItems.length > 0
      ? knowItems
      : negative.length > 0
        ? negative.map((a) => `Wie stark fällt ${a.label.toLowerCase()} im Alltag auf?`).slice(0, 3)
        : ['Wie hält es sich nach mehreren Monaten?', 'Was würdest du vor dem Kauf prüfen?'];

  if (buyItems.length === 0 && avoidItems.length === 0 && insights.experienceCount === 0) {
    return null;
  }

  return (
    <section>
      <SectionTitle>Kaufentscheidung</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <p className="mono-data flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-positive-ink">
            <ThumbsUp className="h-4 w-4" strokeWidth={2.2} />
            Kaufen, wenn
          </p>
          <ul className="mt-3 space-y-2.5">
            {(buyItems.length > 0 ? buyItems : ['die ersten Besitzer weiter positive Langzeitdaten liefern']).map(
              (item) => (
                <li key={item} className="flex gap-2 text-[0.9375rem] leading-snug text-label">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
                  <span>{item}</span>
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="card p-4">
          <p className="mono-data flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-regret-ink">
            <ThumbsDown className="h-4 w-4" strokeWidth={2.2} />
            Lieber nicht, wenn
          </p>
          <ul className="mt-3 space-y-2.5">
            {(avoidItems.length > 0 ? avoidItems : ['du ohne mehr echte Nutzung kein Risiko eingehen willst']).map(
              (item) => (
                <li key={item} className="flex gap-2 text-[0.9375rem] leading-snug text-label">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-regret" />
                  <span>{item}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="card mt-3 p-4">
        <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent-ink">
          Vor dem Kauf klären
        </p>
        <div className="mt-3 space-y-2">
          {questions.slice(0, 3).map((item) => (
            <p key={item} className="ledger-row text-[0.9375rem]">
              <span className="min-w-0 text-muted-foreground">{item}</span>
              <span className="leader" aria-hidden />
              <span className="mono-data shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-label">
                Fragen
              </span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustPanel({ insights }: { insights: ProductInsightsDto }) {
  const verification = insights.verification;
  const hasOwners = verification.total > 0;
  const level =
    !hasOwners
      ? 'Noch offen'
      : verification.verified > 0
        ? verification.verifiedShare >= 50
          ? 'Verifiziertes Signal'
          : 'Gemischter Nachweis'
        : 'Selbst deklariert';

  return (
    <section>
      <SectionTitle>Vertrauen</SectionTitle>
      <div className="card overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.7rem] bg-accent-soft text-accent-ink">
              <UserCheck className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
                {level}
              </p>
              <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
                Verifizierte Besitzer zählen im Score stärker. Selbst deklarierte Stimmen bleiben
                sichtbar, aber weniger gewichtet.
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-fill-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${verification.verifiedShare}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 hairline">
          <TrustMetric
            icon={<BadgeCheck className="h-4 w-4" strokeWidth={2.3} />}
            label="Verifiziert"
            value={verification.verified}
          />
          <TrustMetric
            icon={<UsersRound className="h-4 w-4" strokeWidth={2.3} />}
            label="Selbst"
            value={verification.selfDeclared}
          />
          <TrustMetric
            icon={<ScanBarcode className="h-4 w-4" strokeWidth={2.3} />}
            label="Offen"
            value={verification.unverified}
          />
        </div>
      </div>
    </section>
  );
}

function TrustMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3 text-center">
      <span className="text-accent-ink">{icon}</span>
      <span className="font-display text-[1.7rem] leading-none text-label">{value}</span>
      <span className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function QuickSignalPanel({ insights }: { insights: ProductInsightsDto }) {
  const quick = insights.quickVotes;
  if (quick.count === 0) return null;

  return (
    <section>
      <SectionTitle>3-Sekunden-Signal</SectionTitle>
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.7rem] bg-unsure-soft text-unsure-ink">
            <Bolt className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[2.3rem] leading-none text-label">
              {quick.rebuy ?? '–'}
              {quick.rebuy !== null && <span className="text-[1.2rem]">%</span>}
            </p>
            <p className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
              {quick.count} Schnellcheck{quick.count === 1 ? '' : 's'} aus dem Swipe-Flow. Dieses
              Signal bleibt getrennt vom belastbaren Wudly Score.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[0.7rem] bg-positive-soft px-3 py-2 text-positive-ink">
            <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.14em]">
              Wieder kaufen
            </p>
            <p className="font-display text-[1.8rem] leading-none">{quick.yes}</p>
          </div>
          <div className="rounded-[0.7rem] bg-regret-soft px-3 py-2 text-regret-ink">
            <p className="mono-data text-[0.625rem] font-semibold uppercase tracking-[0.14em]">
              Nie wieder
            </p>
            <p className="font-display text-[1.8rem] leading-none">{quick.no}</p>
          </div>
        </div>
      </div>
    </section>
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
      ? 'Signal im Aufbau'
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
      {ins.aiHeadline && <AiInsightCard headline={ins.aiHeadline} />}

      <DecisionBrief
        insights={ins}
        positive={positive}
        negative={negative}
        knowItems={knowItems}
      />

      <div className="lg:hidden">
        <TrustPanel insights={ins} />
      </div>

      <div className="lg:hidden">
        <QuickSignalPanel insights={ins} />
      </div>

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
    <div className="animate-fade mx-auto grid max-w-5xl gap-6 pb-4 pt-3 lg:grid-cols-[minmax(0,42rem)_20rem] lg:items-start">
      <div className="space-y-5">
      <JsonLd data={structuredData} />

      {/* 1 · Editorial hero: image beside serif title, mono meta overline */}
      <section className="animate-rise flex items-center gap-4">
        <Thumb
          product={product}
          className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
          rounded="rounded-[1rem]"
          pollForPhoto
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
            <div className="min-w-0">
              <h1 className="font-display text-balance text-[1.9rem] leading-[1.02] text-label">
                {product.canonicalName}
              </h1>
              {ins.wudlySeal && <SealBadge size="lg" className="mt-2" />}
            </div>
            <ShareButton
              title={`${product.canonicalName} — Würdest du es wieder kaufen?`}
              text={
                ins.aiHeadline ??
                (earlySignal
                  ? `Signal im Aufbau: ${earlyYesCount} von ${ins.ownerCount} Besitzern würden es wieder kaufen.`
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
          Signal im Aufbau: noch zu wenige Daten für einen belastbaren Score.
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

      <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
        <TrustPanel insights={ins} />
        <QuickSignalPanel insights={ins} />
        <div className="card p-4">
          <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Nächster Schritt
          </p>
          <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
            Die beste Hilfe für andere Käufer ist eine echte Langzeiterfahrung zu diesem Produkt.
          </p>
          <Link
            href={`/products/${id}/own`}
            className="press mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[0.9375rem] font-semibold text-[#f1efe6] shadow-[var(--shadow-glow)]"
          >
            <BadgeCheck className="h-4 w-4" strokeWidth={2.3} />
            Ich besitze es
          </Link>
        </div>
      </aside>
    </div>
  );
}
