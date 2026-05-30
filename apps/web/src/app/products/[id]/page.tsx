import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ExperienceDto, QuestionDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { ScoreRing } from '@/components/ScoreRing';
import { AspectList } from '@/components/AspectList';
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
      description: `Wiederkauf-Score ${score ?? '–'} · ${product.insights.experienceCount} echte Erfahrungen. ${product.brand ?? ''}`,
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
    <div className="space-y-6 pb-4">
      {/* Header */}
      <section className="animate-rise">
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-sunken text-3xl">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.canonicalName} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>📦</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-ink">
              {product.canonicalName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {product.brand && <span className="font-semibold text-ink">{product.brand}</span>}
              {product.category && <Pill tone="accent">{product.category.name}</Pill>}
            </div>
          </div>
        </div>
      </section>

      {/* Scores */}
      <Card className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center">
          <ScoreRing score={ins.rebuyScore} tone="auto" label="Wiederkauf" />
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing score={ins.regretScore} tone="regret" label="Regret" />
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="text-3xl font-black tabular-nums text-ink">{ins.experienceCount}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Erfahrungen
          </div>
          <div className="text-xs text-muted-foreground">{ins.ownerCount} Besitzer</div>
        </div>
      </Card>

      {!hasData && (
        <EmptyState
          icon="🌱"
          title="Noch keine Erfahrungen"
          description="Sei der erste Besitzer und teile, ob du es wieder kaufen würdest."
          action={
            <Link
              href={`/products/${id}/own`}
              className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              📦 Ich besitze es
            </Link>
          }
        />
      )}

      {/* Strengths & problems */}
      {hasData && (ins.topPositiveAspects.length > 0 || ins.topNegativeAspects.length > 0) && (
        <Card className="grid gap-6 sm:grid-cols-2">
          <AspectList
            title="Top-Stärken"
            aspects={ins.topPositiveAspects}
            tone="positive"
            emptyHint="Noch keine Stärken genannt."
          />
          <AspectList
            title="Top-Probleme"
            aspects={ins.topNegativeAspects}
            tone="negative"
            emptyHint="Noch keine Probleme genannt."
          />
        </Card>
      )}

      {/* Wish known */}
      {ins.wishKnownHighlights.length > 0 && (
        <Card>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-ink">
            <span aria-hidden>💡</span> Das hätten Besitzer gerne vorher gewusst
          </h3>
          <ul className="space-y-2">
            {ins.wishKnownHighlights.map((wish, i) => (
              <li key={i} className="rounded-2xl bg-unsure-soft/50 p-3 text-sm text-unsure-ink">
                {wish}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Audience */}
      {hasData && (ins.suitedFor.length > 0 || ins.notSuitedFor.length > 0) && (
        <Card className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold text-positive-ink">✅ Geeignet für</h3>
            {ins.suitedFor.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-ink">
                {ins.suitedFor.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-positive">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Noch offen.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-regret-ink">🚫 Eher nicht für</h3>
            {ins.notSuitedFor.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-ink">
                {ins.notSuitedFor.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-regret">•</span>
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
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <span aria-hidden>⏳</span> Wie lange im Einsatz
          </h3>
          <UsageDurationChart stats={ins.usageDurationStats} />
        </Card>
      )}

      {/* Questions */}
      <section>
        <SectionHeading
          title="Fragen an Besitzer"
          subtitle={questions.length > 0 ? `${questions.length} Frage${questions.length === 1 ? '' : 'n'}` : undefined}
          action={{ label: 'Frage stellen', href: `/products/${id}/ask` }}
        />
        {questions.length > 0 ? (
          <div className="space-y-3">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🤔"
            title="Noch keine Fragen"
            description="Stell den Besitzern, was dich wirklich interessiert."
            action={
              <Link
                href={`/products/${id}/ask`}
                className="inline-flex h-11 items-center rounded-2xl bg-surface px-5 text-sm font-semibold text-ink ring-1 ring-border"
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
          <div className="space-y-3">
            {experiences.map((exp) => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/90 px-4 py-3 backdrop-blur-lg md:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Link
            href={`/products/${id}/own`}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-bold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            📦 Ich besitze es
          </Link>
          <Link
            href={`/products/${id}/ask`}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-surface text-sm font-bold text-ink ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            💬 Besitzer fragen
          </Link>
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </div>
  );
}
