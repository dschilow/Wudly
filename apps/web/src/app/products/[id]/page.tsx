import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Package,
  MessageSquarePlus,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  Leaf,
  HelpCircle,
} from 'lucide-react';
import type { ExperienceDto, QuestionDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ScoreRing } from '@/components/ScoreRing';
import { AspectList } from '@/components/AspectList';
import { AiInsightCard } from '@/components/AiInsightCard';
import { UsageDurationChart } from '@/components/UsageDurationChart';
import { ExperienceCard } from '@/components/ExperienceCard';
import { QuestionCard } from '@/components/QuestionCard';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { SectionHeading } from '@/components/ui/SectionHeading';
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
    return {
      title: product.canonicalName,
      description:
        product.insights.aiHeadline ??
        `Wiederkauf-Score ${score ?? '–'} · ${product.insights.experienceCount} echte Erfahrungen.`,
    };
  } catch {
    return { title: 'Produkt' };
  }
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

  const [experiences, questions] = await Promise.all([
    safe(api.products.experiences(id, { next: { revalidate: 20 } }), [] as ExperienceDto[]),
    safe(api.products.questions(id, { next: { revalidate: 20 } }), [] as QuestionDto[]),
  ]);

  const ins = product.insights;
  const hasData = ins.experienceCount > 0;

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <section className="animate-rise flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-lg)] bg-surface-sunken text-muted-foreground ring-1 ring-border">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.canonicalName} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-tight text-ink">
            {product.canonicalName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {product.brand && <span className="font-semibold text-ink-soft">{product.brand}</span>}
            {product.category && <Pill tone="accent">{product.category.name}</Pill>}
          </div>
        </div>
      </section>

      {/* Scores */}
      <Card className="grid grid-cols-3 items-center gap-2 py-6 text-center">
        <ScoreRing score={ins.rebuyScore} tone="auto" label="Wiederkauf" />
        <ScoreRing score={ins.regretScore} tone="regret" label="Regret" />
        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className="text-[1.75rem] font-extrabold tnum leading-none text-ink">
            {ins.experienceCount}
          </div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Erfahrungen
          </div>
          <div className="mt-1 text-xs text-faint">{ins.ownerCount} Besitzer</div>
        </div>
      </Card>

      {/* AI summary */}
      {ins.aiHeadline && <AiInsightCard headline={ins.aiHeadline} />}

      {!hasData && (
        <EmptyState
          icon={Leaf}
          title="Noch keine Erfahrungen"
          description="Sei der erste Besitzer und teile, ob du es wieder kaufen würdest."
          action={
            <Link
              href={`/products/${id}/own`}
              className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-lg)] bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <Package className="h-4 w-4" /> Ich besitze es
            </Link>
          }
        />
      )}

      {/* Strengths & problems */}
      {hasData && (ins.topPositiveAspects.length > 0 || ins.topNegativeAspects.length > 0) && (
        <Card className="grid gap-6 sm:grid-cols-2">
          <AspectList title="Top-Stärken" aspects={ins.topPositiveAspects} tone="positive" />
          <AspectList title="Top-Probleme" aspects={ins.topNegativeAspects} tone="negative" />
        </Card>
      )}

      {/* Wish known */}
      {ins.wishKnownHighlights.length > 0 && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Lightbulb className="h-4 w-4 text-unsure" strokeWidth={2.2} aria-hidden />
            Das hätten Besitzer gerne vorher gewusst
          </h3>
          <ul className="space-y-2">
            {ins.wishKnownHighlights.map((wish, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-md)] border-l-2 border-unsure bg-unsure-soft/40 px-3.5 py-2.5 text-sm text-unsure-ink"
              >
                {wish}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Audience */}
      {hasData && (ins.suitedFor.length > 0 || ins.notSuitedFor.length > 0) && (
        <Card className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-positive-ink">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} /> Geeignet für
            </h3>
            {ins.suitedFor.length > 0 ? (
              <ul className="space-y-2 text-sm text-ink">
                {ins.suitedFor.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Noch offen.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-regret-ink">
              <XCircle className="h-4 w-4" strokeWidth={2.2} /> Eher nicht für
            </h3>
            {ins.notSuitedFor.length > 0 ? (
              <ul className="space-y-2 text-sm text-ink">
                {ins.notSuitedFor.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-regret" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Noch offen.</p>
            )}
          </div>
        </Card>
      )}

      {/* Usage duration */}
      {hasData && (
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <Clock className="h-4 w-4 text-accent" strokeWidth={2.2} aria-hidden />
            Wie lange im Einsatz
          </h3>
          <UsageDurationChart stats={ins.usageDurationStats} />
        </Card>
      )}

      {/* Questions */}
      <section>
        <SectionHeading
          title="Fragen an Besitzer"
          subtitle={
            questions.length > 0
              ? `${questions.length} Frage${questions.length === 1 ? '' : 'n'}`
              : undefined
          }
          action={{ label: 'Frage stellen', href: `/products/${id}/ask` }}
        />
        {questions.length > 0 ? (
          <div className="space-y-2.5">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={HelpCircle}
            title="Noch keine Fragen"
            description="Stell den Besitzern, was dich wirklich interessiert."
            action={
              <Link
                href={`/products/${id}/ask`}
                className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-surface px-5 text-sm font-semibold text-ink ring-1 ring-border"
              >
                Besitzer fragen
              </Link>
            }
          />
        )}
      </section>

      {/* Recent experiences */}
      {experiences.length > 0 && (
        <section>
          <SectionHeading title="Echte Erfahrungen" subtitle={`${experiences.length} geteilt`} />
          <div className="space-y-2.5">
            {experiences.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/80 px-4 py-3 backdrop-blur-xl md:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-2.5">
          <Link
            href={`/products/${id}/own`}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-lg)] bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            <Package className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
            Ich besitze es
          </Link>
          <Link
            href={`/products/${id}/ask`}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-lg)] bg-surface text-sm font-semibold text-ink ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            <MessageSquarePlus className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
            Besitzer fragen
          </Link>
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </div>
  );
}
