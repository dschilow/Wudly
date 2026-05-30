import Link from 'next/link';
import { Search, Package, BarChart3, Sparkles, Zap, Target, ArrowRight, Leaf } from 'lucide-react';
import type { RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { EmptyState } from '@/components/states/States';

// Home reflects live data; revalidate frequently.
export const revalidate = 30;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [topRebuy, mostDiscussed] = await Promise.all([
    safe(api.rankings.topRebuy(4, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
    safe(api.rankings.mostDiscussed(3, { next: { revalidate: 30 } }), [] as RankingEntryDto[]),
  ]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="animate-rise relative -mx-4 overflow-hidden px-4 pb-2 pt-6 text-center">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
            Echte Besitzer · Echte Nutzung
          </span>
          <h1 className="mx-auto mt-5 max-w-[15ch] text-balance text-[2.5rem] font-extrabold leading-[1.04] tracking-tight text-ink sm:text-5xl">
            Würdest du es <span className="text-accent">wieder kaufen?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-[0.975rem] leading-relaxed text-muted-foreground">
            Wudly zeigt dir, was echte Besitzer nach echter Nutzung sagen — kein Marketing, keine
            Sternchen-Inflation.
          </p>

          <div className="mx-auto mt-7 grid max-w-md gap-2.5">
            <Link
              href="/check"
              className="group flex h-[3.25rem] items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-primary text-[0.95rem] font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
            >
              <Search className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.2} />
              Produkt prüfen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/check?own=1"
                className="flex h-12 items-center justify-center gap-1.5 rounded-[var(--radius-lg)] bg-surface text-sm font-semibold text-ink shadow-xs ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]"
              >
                <Package className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
                Ich besitze es
              </Link>
              <Link
                href="/rankings"
                className="flex h-12 items-center justify-center gap-1.5 rounded-[var(--radius-lg)] bg-surface text-sm font-semibold text-ink shadow-xs ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]"
              >
                <BarChart3 className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
                Top &amp; Flop
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="grid grid-cols-3 gap-2.5">
        {[
          { icon: Search, title: 'Suchen', text: 'Produkt finden oder vorschlagen' },
          { icon: Zap, title: '3 Klicks', text: 'Erfahrung in Sekunden teilen' },
          { icon: Target, title: 'Entscheiden', text: 'Wiederkauf- & Regret-Score sehen' },
        ].map((step) => (
          <div
            key={step.title}
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-3.5 text-center shadow-xs"
          >
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
              <step.icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.2} />
            </div>
            <div className="mt-2 text-sm font-bold text-ink">{step.title}</div>
            <div className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">{step.text}</div>
          </div>
        ))}
      </section>

      {/* Top rebuy */}
      <section>
        <SectionHeading
          title="Würden sie wieder kaufen"
          subtitle="Höchster Wiederkauf-Score"
          action={{ label: 'Alle', href: '/rankings' }}
        />
        {topRebuy.length > 0 ? (
          <div className="space-y-2.5">
            {topRebuy.map((entry) => (
              <ProductCard key={entry.product.id} product={entry.product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Leaf}
            title="Noch keine Daten"
            description="Sei der Erste und teile eine Produkterfahrung."
          />
        )}
      </section>

      {/* Most discussed */}
      {mostDiscussed.length > 0 && (
        <section>
          <SectionHeading
            title="Am meisten diskutiert"
            subtitle="Produkte mit den meisten Erfahrungen"
            action={{ label: 'Mehr', href: '/rankings' }}
          />
          <div className="space-y-2.5">
            {mostDiscussed.map((entry) => (
              <ProductCard key={entry.product.id} product={entry.product} />
            ))}
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-primary p-7 text-center text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 0%, rgba(79,70,229,0.5), transparent 60%)',
          }}
          aria-hidden
        />
        <div className="relative">
          <h2 className="text-xl font-bold">Du besitzt ein Produkt?</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/65">
            Deine Erfahrung hilft anderen, bessere Kaufentscheidungen zu treffen. In unter einer
            Minute.
          </p>
          <Link
            href="/check?own=1"
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-white px-6 text-sm font-bold text-ink transition-transform active:scale-[0.98]"
          >
            <Package className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
            Erfahrung teilen
          </Link>
        </div>
      </section>
    </div>
  );
}
