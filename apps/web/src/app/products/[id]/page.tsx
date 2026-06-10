import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  BadgeCheck,
  Battery,
  ChevronRight,
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
import { rebuyVerdict } from '@/lib/verdict';
import { plural } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, breadcrumbJsonLd, absoluteUrl } from '@/lib/seo';
import { ShareButton } from '@/components/ShareButton';
import { ScoreTrend } from '@/components/ScoreTrend';
import { Thumb } from '@/components/Thumb';
import { UsageDurationChart } from '@/components/UsageDurationChart';
import { ExperienceCard } from '@/components/ExperienceCard';
import { ExternalRatingsCard } from '@/components/ExternalRatingsCard';
import { QuestionCard } from '@/components/QuestionCard';
import { ShowcaseCard } from '@/components/showcase/ShowcaseCard';
import { Pill } from '@/components/ui/Pill';
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 pb-2.5 pt-1 text-[1.3rem] font-bold tracking-tight text-label">
      {children}
    </h2>
  );
}

/* A neutral icon for "Was du vorher wissen solltest" rows. We rotate a small,
   calm icon set so the rows feel designed without inventing fake meaning. */
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

  const verdict = rebuyVerdict(ins.rebuyScore);
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

  // Verdict headline shown in the recommend card (calm, one line).
  const recommendLabel =
    ins.rebuyScore === null
      ? 'Noch keine klare Tendenz'
      : ins.rebuyScore >= 75
        ? 'Eher empfehlenswert'
        : ins.rebuyScore >= 50
          ? 'Gemischtes Echo'
          : 'Eher nicht empfehlenswert';
  const recommendSub =
    ins.rebuyScore === null
      ? 'Noch nicht genug echte Nutzung für ein Urteil.'
      : ins.rebuyScore >= 75
        ? 'Die Mehrheit der Wudly Community würde dieses Produkt weiterempfehlen.'
        : ins.rebuyScore >= 50
          ? 'Die Community ist hier geteilter Meinung.'
          : 'Viele Besitzer würden es nicht wieder kaufen.';

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

  return (
    <div className="animate-fade space-y-4 pb-4 pt-1">
      <JsonLd data={structuredData} />

      {/* 1 · Product image, name, brand, category */}
      <section className="animate-rise flex flex-col items-center pt-2 text-center">
        <Thumb
          product={product}
          className="h-44 w-44 ring-1 ring-border sm:h-52 sm:w-52"
          rounded="rounded-[1.5rem]"
        />
        <div className="mt-4 flex w-full items-start justify-center gap-2">
          <h1 className="text-balance text-[1.9rem] font-bold leading-[1.05] tracking-tight text-label">
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
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[0.9375rem] text-muted-foreground">
          {product.brand && <span className="font-medium">{product.brand}</span>}
          {product.category && (
            <Link href={`/kategorie/${product.category.slug}`} className="tap-dim">
              <Pill tone="neutral">{product.category.name}</Pill>
            </Link>
          )}
        </div>
      </section>

      {/* 2 · Recommend verdict card */}
      <Link
        href="#signal"
        className="press card flex items-center gap-3.5 p-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{ background: verdict.soft, color: verdict.ink }}
        >
          <BadgeCheck className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.1875rem] font-bold leading-tight" style={{ color: verdict.ink }}>
            {recommendLabel}
          </p>
          <p className="mt-0.5 text-[0.9375rem] leading-snug text-muted-foreground">
            {recommendSub}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-label-3" strokeWidth={2.4} />
      </Link>

      {/* 3 · Wudly Signal panel */}
      <section
        id="signal"
        className="overflow-hidden rounded-[1.5rem] ring-1 ring-positive/12 scroll-mt-20"
        style={{ background: 'linear-gradient(165deg,#f1f7f3,#e9f4ec)' }}
      >
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[1.0625rem] font-bold tracking-tight text-accent-ink">
                Wudly Signal
              </h2>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-accent/12 text-[0.65rem] font-bold text-accent-ink">
                i
              </span>
            </div>
            {earlySignal ? (
              <>
                <p className="mt-2 text-[2.6rem] font-bold leading-none text-positive-ink">
                  Frühes Signal
                </p>
                <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-label">
                  {earlyYesCount} von {ins.ownerCount} würden es wieder kaufen
                </p>
              </>
            ) : ins.rebuyScore !== null ? (
              <>
                <p className="tnum mt-2 text-[3rem] font-bold leading-none text-positive-ink">
                  {ins.rebuyScore}%
                </p>
                <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-label">
                  würden es nach 6 Monaten
                  <br />
                  wieder kaufen
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[2rem] font-bold leading-none text-muted-foreground">
                  Noch offen
                </p>
                <p className="mt-2 text-[1.0625rem] font-semibold leading-snug text-label">
                  Noch nicht genug echte Nutzung
                </p>
              </>
            )}
          </div>
          <SignalRing score={earlySignal ? null : ins.rebuyScore} owners={ins.ownerCount} />
        </div>

        <Link
          href="#nutzung"
          className="tap flex items-center gap-2 border-t border-positive/12 px-5 py-3.5"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[0.6rem] bg-positive/12 text-positive-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path
                d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-positive-ink">
              {signalStrength}
            </span>
            <span className="block text-[0.875rem] text-muted-foreground">
              Datenbasis: {ins.experienceCount}{' '}
              {plural(ins.experienceCount, 'Bewertung', 'Bewertungen')}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-label-3" strokeWidth={2.4} />
        </Link>
      </section>

      {/* Early-signal disclaimer (honest, no hard score) */}
      {earlySignal && (
        <p className="px-1 text-[0.9375rem] leading-snug text-muted-foreground">
          Frühes Signal: {earlyYesCount} von {ins.ownerCount} Besitzern würden es wieder kaufen.
          Noch zu wenige Daten für einen belastbaren Score.
        </p>
      )}

      {/* 4 · Was du vorher wissen solltest */}
      {knowItems.length > 0 && (
        <section>
          <SectionTitle>Was du vorher wissen solltest</SectionTitle>
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
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.7rem] bg-fill-2 text-accent">
                    <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.1} />
                  </span>
                  <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-label">{wish}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5 + 6 · Stärken / Kritik */}
      {hasData && (positive.length > 0 || negative.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card flex flex-col p-4 ring-1 ring-positive/10">
            <div className="flex items-center justify-between">
              <h3 className="text-[1.0625rem] font-bold text-positive-ink">Stärken</h3>
              <ChevronRight className="h-4 w-4 text-label-3" strokeWidth={2.4} />
            </div>
            <ul className="mt-3 space-y-2.5">
              {positive.length > 0 ? (
                positive.map((a) => (
                  <li key={a.key} className="flex items-start gap-2 text-[0.9375rem] text-label">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-positive text-white">
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
          <div className="card flex flex-col p-4 ring-1 ring-regret/10">
            <div className="flex items-center justify-between">
              <h3 className="text-[1.0625rem] font-bold text-regret-ink">Kritik</h3>
              <ChevronRight className="h-4 w-4 text-label-3" strokeWidth={2.4} />
            </div>
            <ul className="mt-3 space-y-2.5">
              {negative.length > 0 ? (
                negative.map((a) => (
                  <li key={a.key} className="flex items-start gap-2 text-[0.9375rem] text-label">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-regret text-white">
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

      {/* Bewertungen anderswo — aggregated facts from other platforms. Clearly
          labelled, source-linked, and never part of the Wudly Signal. */}
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

      {/* 7 · Nach Nutzungsdauer */}
      {hasData && publicExperiences.length >= 3 && (
        <section id="nutzung" className="scroll-mt-20">
          <SectionTitle>Nach Nutzungsdauer</SectionTitle>
          <div className="card p-4">
            <ScoreTrend experiences={experiences} />
          </div>
        </section>
      )}

      {hasData && (
        <section>
          <SectionTitle>Häufige Nutzungsdauer</SectionTitle>
          <div className="card p-4">
            <UsageDurationChart stats={ins.usageDurationStats} />
          </div>
        </section>
      )}

      {/* 8 · Fragen an Besitzer */}
      <section>
        <div className="flex items-end justify-between px-1 pb-1">
          <SectionTitle>Fragen an Besitzer</SectionTitle>
          <Link href={`/products/${id}/ask`} className="tap-dim pb-3 text-[0.9375rem] text-accent">
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
          <SectionTitle>Echte Erfahrungen · {experiences.length}</SectionTitle>
          <div className="space-y-2.5">
            {experiences.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        </section>
      )}

      {/* Wudly Showcase — clearly separated commercial / creator content. */}
      {showcases.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-1 pb-0.5 pt-2">
            <span className="h-px flex-1 bg-separator" aria-hidden />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
        </section>
      )}

      {/* 9 · Sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-[3.75rem] z-30 border-t border-separator bg-canvas/80 px-5 py-2.5 backdrop-blur-2xl backdrop-saturate-150 md:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Link
            href={`/products/${id}/own`}
            className="press flex h-[2.875rem] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
          >
            <BadgeCheck className="h-5 w-5" strokeWidth={2.2} />
            Ich besitze es
          </Link>
          <Link
            href={`/products/${id}/ask`}
            className="press flex h-[2.875rem] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-fill-2 text-[1.0625rem] font-semibold text-label"
          >
            <MessagesSquare className="h-5 w-5" strokeWidth={2.1} />
            Frage stellen
          </Link>
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </div>
  );
}

/* Compact ring used inside the Wudly Signal panel (people glyph at center). */
function SignalRing({ score, owners }: { score: number | null; owners: number }) {
  const pct = score ?? 0;
  return (
    <div
      className="relative grid h-[6.5rem] w-[6.5rem] shrink-0 place-items-center rounded-full"
      style={{
        background:
          score === null
            ? 'var(--color-fill-2)'
            : `conic-gradient(var(--color-positive) ${pct}%, rgba(47,159,86,0.14) 0)`,
      }}
    >
      <div className="grid h-[5.1rem] w-[5.1rem] place-items-center rounded-full bg-surface/80 backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-positive-ink" fill="none" aria-hidden>
          <path
            d="M16 11a4 4 0 1 0-8 0M3 20a6 6 0 0 1 18 0"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.9" />
        </svg>
      </div>
      <span className="sr-only">
        {score === null ? 'Noch kein Signal' : `${score}% von ${owners} Besitzern`}
      </span>
    </div>
  );
}
