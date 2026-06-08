import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronRight,
  Hourglass,
  Image,
  Package,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[0.95rem] bg-white/[0.08] px-3 py-2 ring-1 ring-white/12">
      <div className="text-[1.0625rem] font-bold leading-none text-white">{value}</div>
      <div className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/48">
        {label}
      </div>
    </div>
  );
}

function HeroVisual({
  product,
  score,
  owners,
}: {
  product?: ProductSummaryDto;
  score: number | null;
  owners: number;
}) {
  const meta = product
    ? [product.brand, product.category?.name].filter(Boolean).join(' · ') || 'Produkt'
    : 'Klarer als Sterne';

  const content = (
    <>
      <div className="flex items-start gap-3">
        {product ? (
          <Thumb
            product={product}
            className="h-20 w-20 ring-white/20 sm:h-24 sm:w-24"
            rounded="rounded-[1.15rem]"
          />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[1.15rem] bg-white/12 text-white ring-1 ring-white/14">
            <BadgeCheck className="h-7 w-7" strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-white/62 ring-1 ring-white/12">
            <Sparkles className="h-3 w-3" strokeWidth={2.4} aria-hidden />
            Live-Signal
          </p>
          <h3 className="mt-2 line-clamp-2 text-[1.25rem] font-bold leading-[1.05] text-white">
            {product?.canonicalName ?? 'Wudly Score'}
          </h3>
          <p className="mt-1 truncate text-[0.8125rem] text-white/58">{meta}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="space-y-2">
          <p className="text-[0.875rem] leading-snug text-white/62">
            {owners} Besitzer liefern das Signal nach echter Nutzung.
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-positive shadow-[0_0_18px_rgba(47,159,86,0.55)]"
              style={{ width: `${Math.max(8, score ?? 0)}%` }}
            />
          </div>
        </div>
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
  const signalCount = [...topRebuy, ...topRegret, ...mostDiscussed].reduce(
    (sum, entry) => sum + entry.product.experienceCount,
    0,
  );

  return (
    <div className="animate-fade space-y-7 pt-2">
      <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
      <section className="relative overflow-hidden rounded-[1.7rem] bg-ink text-white shadow-[var(--shadow-pop)] ring-1 ring-black/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(83,132,255,0.52),transparent_34%),radial-gradient(circle_at_92%_8%,rgba(47,159,86,0.34),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_42%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/[0.07] blur-3xl"
        />
        <div className="relative grid gap-5 p-5 sm:grid-cols-[1fr_18rem] sm:items-center sm:p-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/62 ring-1 ring-white/12">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
              Kaufentscheidung nach echter Nutzung
            </p>
            <h1 className="mt-3 text-balance text-[2.45rem] font-bold leading-[1.02] text-white sm:text-[3rem]">
              Würdest du es wieder kaufen?
            </h1>
            <p className="mt-3 max-w-[22rem] text-pretty text-[1.0625rem] leading-snug text-white/68">
              Scanne Barcode oder Produktfoto und sieh, was Besitzer nach Wochen oder Monaten wirklich sagen.
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
                Kamera & Foto öffnen
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <HeroMetric value={signalCount > 0 ? String(signalCount) : 'Live'} label="Signale" />
              <HeroMetric value="Foto" label="Produktbild" />
              <HeroMetric value="EAN" label="Barcode" />
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

      <section className="grid gap-2.5 sm:grid-cols-3">
        {[
          {
            icon: Camera,
            title: 'Barcode scannt schnell',
            desc: 'EAN/UPC wird direkt mit dem Katalog abgeglichen.',
          },
          {
            icon: Image,
            title: 'Foto wird Produktbild',
            desc: 'Wenn kein Barcode passt, übernimmt Wudly den zentrierten Fotoausschnitt.',
          },
          {
            icon: ShieldCheck,
            title: 'Score statt Sterne',
            desc: 'Das Signal basiert auf echter Besitzdauer und Nutzung.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="card-elevated p-4">
              <span className="grid h-10 w-10 place-items-center rounded-[0.9rem] bg-accent-soft text-accent">
                <Icon className="h-5 w-5" strokeWidth={2.3} aria-hidden />
              </span>
              <h2 className="mt-3 text-[1rem] font-bold leading-tight text-label">{item.title}</h2>
              <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
                {item.desc}
              </p>
            </div>
          );
        })}
      </section>

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
