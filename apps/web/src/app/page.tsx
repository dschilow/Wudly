import Link from 'next/link';
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
    <div className="space-y-10">
      {/* Hero */}
      <section className="animate-rise pt-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-bold text-accent">
          Echte Besitzer · Echte Nutzung
        </span>
        <h1 className="mt-4 text-balance text-4xl font-black leading-[1.05] tracking-tight text-ink md:text-5xl">
          Würdest du es
          <br />
          <span className="text-accent">wieder kaufen?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-base text-muted-foreground">
          Wudly zeigt dir, was echte Besitzer nach echter Nutzung über Produkte sagen — kein
          Marketing, keine Sternchen-Inflation.
        </p>

        <div className="mx-auto mt-7 grid max-w-md gap-3">
          <Link
            href="/check"
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-card transition-transform active:scale-[0.98]"
          >
            🔍 Produkt prüfen
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/check?own=1"
              className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-surface text-sm font-semibold text-ink shadow-card ring-1 ring-border transition-transform active:scale-[0.98]"
            >
              📦 Ich besitze es
            </Link>
            <Link
              href="/rankings"
              className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-surface text-sm font-semibold text-ink shadow-card ring-1 ring-border transition-transform active:scale-[0.98]"
            >
              📊 Top &amp; Flop
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { icon: '🔍', title: 'Suchen', text: 'Produkt finden oder vorschlagen' },
          { icon: '⚡', title: '3 Klicks', text: 'Erfahrung in Sekunden teilen' },
          { icon: '🎯', title: 'Entscheiden', text: 'Wiederkauf- & Regret-Score sehen' },
        ].map((step) => (
          <div
            key={step.title}
            className="rounded-2xl bg-surface p-3.5 text-center shadow-card ring-1 ring-border"
          >
            <div className="text-2xl" aria-hidden>
              {step.icon}
            </div>
            <div className="mt-1 text-sm font-bold text-ink">{step.title}</div>
            <div className="mt-0.5 text-[0.7rem] leading-tight text-muted-foreground">
              {step.text}
            </div>
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
          <div className="space-y-3">
            {topRebuy.map((entry) => (
              <ProductCard key={entry.product.id} product={entry.product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🌱"
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
          <div className="space-y-3">
            {mostDiscussed.map((entry) => (
              <ProductCard key={entry.product.id} product={entry.product} />
            ))}
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section className="overflow-hidden rounded-3xl bg-ink p-6 text-center text-white">
        <h2 className="text-xl font-extrabold">Du besitzt ein Produkt?</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/70">
          Deine Erfahrung hilft anderen, bessere Kaufentscheidungen zu treffen. In unter einer
          Minute.
        </p>
        <Link
          href="/check?own=1"
          className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 text-sm font-bold text-ink transition-transform active:scale-[0.98]"
        >
          Erfahrung teilen
        </Link>
      </section>
    </div>
  );
}
