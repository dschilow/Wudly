import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ExperienceDto, QuestionDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { productShareImageUrl } from '@/lib/product-media';
import { rebuyVerdict } from '@/lib/verdict';
import { ShareButton } from '@/components/ShareButton';
import { ScoreRing } from '@/components/ScoreRing';
import { Thumb } from '@/components/Thumb';
import { AspectList } from '@/components/AspectList';
import { AiInsightCard } from '@/components/AiInsightCard';
import { UsageDurationChart } from '@/components/UsageDurationChart';
import { ExperienceCard } from '@/components/ExperienceCard';
import { QuestionCard } from '@/components/QuestionCard';
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
    const description =
      product.insights.aiHeadline ??
      `Wiederkauf-Score ${score ?? '–'} · ${product.insights.experienceCount} echte Erfahrungen.`;
    const ogImage = productShareImageUrl(id);
    return {
      title: product.canonicalName,
      description,
      openGraph: {
        title: `${product.canonicalName} — Würdest du es wieder kaufen?`,
        description,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${product.canonicalName} — Würdest du es wieder kaufen?`,
        description,
        images: [ogImage],
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

  const [experiences, questions] = await Promise.all([
    safe(api.products.experiences(id, { next: { revalidate: 20 } }), [] as ExperienceDto[]),
    safe(api.products.questions(id, { next: { revalidate: 20 } }), [] as QuestionDto[]),
  ]);

  const ins = product.insights;
  const hasData = ins.experienceCount > 0;

  const verdict = rebuyVerdict(ins.rebuyScore);

  return (
    <div className="animate-fade space-y-5 pb-4 pt-1">
      {/* Header */}
      <header className="flex items-start gap-3.5 px-1 pt-1">
        <Thumb product={product} className="h-16 w-16" rounded="rounded-[0.95rem]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-[1.625rem] font-bold leading-[1.12] tracking-tight text-label">
            {product.canonicalName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.9375rem] text-muted-foreground">
            {product.brand && <span className="font-medium">{product.brand}</span>}
            {product.category && <Pill tone="neutral">{product.category.name}</Pill>}
          </div>
        </div>
        <ShareButton
          title={`${product.canonicalName} — Würdest du es wieder kaufen?`}
          text={
            product.insights.aiHeadline ??
            `Wiederkauf-Score ${ins.rebuyScore ?? '–'} auf Wudly`
          }
        />
      </header>

      {product.description && (
        <p className="px-1 text-[0.9375rem] leading-snug text-muted-foreground">
          {product.description}
        </p>
      )}

      {/* Verdict hero — the score is the star */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <ScoreRing score={ins.rebuyScore} tone="auto" size={96} />
          <div className="min-w-0 flex-1">
            <div
              className="text-[0.75rem] font-semibold uppercase tracking-[0.06em]"
              style={{ color: verdict.ink }}
            >
              Wiederkauf-Score
            </div>
            <div className="mt-1 text-balance text-[1.3125rem] font-bold leading-[1.12] text-label">
              {verdict.label}
            </div>
            {hasData && ins.rebuyScore !== null && (
              <div className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
                {ins.rebuyScore}% von {ins.ownerCount} Besitzer{ins.ownerCount === 1 ? '' : 'n'}
              </div>
            )}
          </div>
        </div>
        {/* Stat strip */}
        <div className="grid grid-cols-3 border-t border-separator">
          <Stat
            value={ins.regretScore === null ? '–' : String(ins.regretScore)}
            label="Regret"
            tone={ins.regretScore !== null && ins.regretScore >= 40 ? 'regret' : 'muted'}
            divider
          />
          <Stat value={String(ins.experienceCount)} label="Erfahrungen" divider />
          <Stat value={String(ins.ownerCount)} label="Besitzer" />
        </div>
      </div>

      {/* AI summary */}
      {ins.aiHeadline && <AiInsightCard headline={ins.aiHeadline} />}

      {!hasData && (
        <div className="card">
          <EmptyState
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

      {/* Wish known */}
      {ins.wishKnownHighlights.length > 0 && (
        <section>
          <GroupTitle>Das hätten Besitzer vorher gern gewusst</GroupTitle>
          <div className="card overflow-hidden">
            {ins.wishKnownHighlights.map((wish, i) => (
              <div
                key={i}
                className={
                  'px-4 py-3 text-[0.9375rem] leading-snug text-label ' +
                  (i < ins.wishKnownHighlights.length - 1 ? 'hairline' : '')
                }
                style={{ ['--hairline-inset' as string]: '1rem' }}
              >
                {wish}
              </div>
            ))}
          </div>
        </section>
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

      {/* Sticky action bar (iOS bottom toolbar, material) */}
      <div className="safe-bottom fixed inset-x-0 bottom-[3.75rem] z-30 border-t border-separator bg-canvas/80 px-4 py-2.5 backdrop-blur-2xl backdrop-saturate-150 md:bottom-0">
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
