import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronRight,
  Hourglass,
  Package,
  Radar,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { ProductSummaryDto, RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductList } from '@/components/ProductList';
import { ScoreRing } from '@/components/ScoreRing';
import { Thumb } from '@/components/Thumb';
import { EmptyState } from '@/components/states/States';
import { JsonLd } from '@/components/JsonLd';
import { websiteJsonLd, organizationJsonLd } from '@/lib/seo';

export const revalidate = 30;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[1.3125rem] font-bold tracking-tight text-label">{title}</h2>
      {href && (
        <Link
          href={href}
          className="tap-dim flex items-center gap-0.5 text-[0.9375rem] font-medium text-accent"
        >
          Alle
          <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
        </Link>
      )}
    </div>
  );
}

const TRUST = [
  { icon: Users, label: 'Echte Besitzer' },
  { icon: Hourglass, label: 'Nach Nutzung' },
  { icon: ShieldCheck, label: 'Ehrliche Wertung' },
];

function HeroVisual({
  product,
  score,
  owners,
}: {
  product?: ProductSummaryDto;
  score: number | null;
  owners: number;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        {product ? (
          <Thumb product={product} className="h-16 w-16 ring-white/20" rounded="rounded-[1rem]" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[1rem] bg-white/12 text-white ring-1 ring-white/14">
            <BadgeCheck className="h-7 w-7" strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/52">
            Aktuelles Signal
          </p>
          <h3 className="mt-1 truncate text-[1.125rem] font-bold leading-tight text-white">
            {product?.canonicalName ?? 'Wudly Score'}
          </h3>
          <p className="mt-0.5 truncate text-[0.8125rem] text-white/58">
            {product
              ? [product.brand, product.category?.name].filter(Boolean).join(' · ') || 'Produkt'
              : 'Klarer als Sterne'}
          </p>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="max-w-[11rem] text-[0.875rem] leading-snug text-white/62">
          {owners} Besitzer liefern das Signal nach echter Nutzung.
        </p>
        <ScoreRing score={score} tone="auto" size={98} animate className="shrink-0" />
      </div>
    </>
  );

  const className =
    'press relative overflow-hidden rounded-[1.35rem] bg-white/[0.08] p-4 ring-1 ring-white/14 backdrop-blur-xl';

  return product ? (
    <Link href={`/products/${product.id}`} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export default async function HomePage() {
  const [topRebuy, topRegret, mostDiscussed] = await Promise.all([
    safe(api.rankings.topRebuy(5, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.topRegret(5, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.mostDiscussed(3, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
  ]);

  const heroProduct = topRebuy[0]?.product ?? mostDiscussed[0]?.product;
  const heroScore = heroProduct?.rebuyScore ?? 86;
  const heroOwners = heroProduct?.ownerCount ?? 142;

  return (
    <div className="animate-fade space-y-7 pt-2">
      <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
      <section className="relative overflow-hidden rounded-[1.7rem] bg-ink text-white shadow-[var(--shadow-pop)] ring-1 ring-black/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(43,107,255,0.42),transparent_38%),linear-gradient(225deg,rgba(47,159,86,0.28),transparent_42%)]"
        />
        <div className="relative grid gap-5 p-5 sm:grid-cols-[1fr_15rem] sm:items-center">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-white/55">
              Wudly
            </p>
            <h1 className="mt-2 text-balance text-[2.45rem] font-bold leading-[1.02] text-white">
              Würdest du es wieder kaufen?
            </h1>
            <p className="mt-3 max-w-[22rem] text-pretty text-[1.0625rem] leading-snug text-white/68">
              Echte Besitzer. Echte Nutzung. Bessere Käufe.
            </p>

            <div className="mt-5 grid gap-2.5">
              <Link
                href="/check"
                className="press flex h-[3.25rem] items-center justify-center gap-2 rounded-[1rem] bg-white text-[1.0625rem] font-semibold text-ink shadow-[0_14px_30px_-14px_rgba(255,255,255,0.9)]"
              >
                <Search className="h-[1.2rem] w-[1.2rem]" strokeWidth={2.5} />
                Produkt prüfen
                <ArrowRight className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.5} />
              </Link>
              <Link
                href="/check?scan=1"
                className="press flex h-[3.125rem] items-center justify-center gap-2 rounded-[1rem] bg-white/12 text-[1.0625rem] font-semibold text-white ring-1 ring-white/14"
              >
                <Camera className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.4} />
                Kamera öffnen
              </Link>
            </div>
          </div>

          <HeroVisual product={heroProduct} score={heroScore} owners={heroOwners} />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {TRUST.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="rounded-[1rem] bg-surface px-2 py-3 text-center shadow-[var(--shadow-card)]"
            >
              <Icon className="mx-auto h-[1.15rem] w-[1.15rem] text-accent" strokeWidth={2.2} />
              <span className="mt-1.5 block text-center text-[0.75rem] font-medium leading-tight text-muted-foreground">
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      <section className="card-elevated overflow-hidden">
        <div className="p-4">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            So funktioniert Wudly
          </p>
          <div className="mt-3 grid gap-3.5">
            {[
              ['1', 'Scannen oder suchen', 'Barcode, Foto oder Name – Wudly findet das Produkt.'],
              [
                '2',
                'Ehrliches Signal sehen',
                'Der Wiederkauf-Score echter Besitzer – nicht Sterne beim Kauf.',
              ],
              ['3', 'Besser entscheiden', 'Kaufen ohne Reue – oder bewusst verzichten.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="flex items-start gap-3">
                <span className="brand-gradient grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold text-white">
                  {n}
                </span>
                <div className="min-w-0">
                  <div className="text-[0.9375rem] font-semibold leading-tight text-label">
                    {title}
                  </div>
                  <div className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="Würden sie wieder kaufen" href="/rankings" />
        {topRebuy.length > 0 ? (
          <ProductList products={topRebuy.map((e) => ({ product: e.product, rank: e.rank }))} />
        ) : (
          <div className="card">
            <EmptyState
              icon={<Package className="h-7 w-7" strokeWidth={1.8} />}
              title="Noch keine Daten"
              description="Sei der Erste und teile eine Produkterfahrung."
            />
          </div>
        )}
      </section>

      {topRegret.length > 0 && (
        <section>
          <SectionHeader title="Bereuen Besitzer am häufigsten" href="/rankings" />
          <ProductList
            products={topRegret.map((e) => ({ product: e.product, rank: e.rank }))}
            emphasis="regret"
          />
        </section>
      )}

      {mostDiscussed.length > 0 && (
        <section>
          <SectionHeader title="Am meisten diskutiert" href="/rankings" />
          <ProductList products={mostDiscussed.map((e) => e.product)} />
        </section>
      )}

      <Link href="/rankings" className="card press tap block overflow-hidden">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-regret-soft text-regret-ink">
            <Radar className="h-[1.25rem] w-[1.25rem]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium leading-tight text-label">
              Regret-Radar ansehen
            </div>
            <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Kategorien, in denen Käufer am häufigsten danebenliegen.
            </div>
          </div>
          <ChevronRight
            className="-mr-1 h-[1.0625rem] w-[1.0625rem] shrink-0 text-label-3"
            strokeWidth={2.5}
          />
        </div>
      </Link>

      <Link href="/check?own=1" className="card press tap block overflow-hidden">
        <div className="flex items-center gap-3.5 px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Package className="h-[1.25rem] w-[1.25rem]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[1.0625rem] font-medium leading-tight text-label">
              Teile deine Erfahrung
            </div>
            <div className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              In unter einer Minute. Hilft anderen beim Kauf.
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
