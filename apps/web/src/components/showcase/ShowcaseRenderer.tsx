import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Quote,
  Star,
  Users,
} from 'lucide-react';
import type { ShowcaseBlockDto, ShowcaseDetailDto } from '@wudly/shared';
import { DisclosureBadge } from '@/components/DisclosureBadge';
import { num, qaItems, specItems, str, strArray, titledItems } from './blocks';

/**
 * Renders a published Showcase from its blocks. Everything here is clearly-
 * labelled creator / brand content — the disclosure header is always shown and
 * the whole section is visually distinct from the neutral Wudly Signal.
 */
export function ShowcaseRenderer({ showcase }: { showcase: ShowcaseDetailDto }) {
  return (
    <div className="space-y-4">
      <ShowcaseDisclosureHeader showcase={showcase} />
      {showcase.blocks.map((block) => (
        <Block key={block.id} block={block} showcase={showcase} />
      ))}
    </div>
  );
}

/** The always-on transparency header — who made this and under what disclosure. */
function ShowcaseDisclosureHeader({ showcase }: { showcase: ShowcaseDetailDto }) {
  const { profile } = showcase;
  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-fill-2 text-[1.1rem] font-bold text-muted-foreground">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            profile.displayName.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={`/creator/${profile.slug}`}
            className="tap-dim text-[0.9375rem] font-semibold text-label"
          >
            {profile.displayName}
          </a>
          <p className="text-[0.75rem] text-muted-foreground">
            Präsentiert von einem Wudly-Profil · kein Teil des neutralen Scores
          </p>
        </div>
      </div>
      <div className="border-t border-separator p-3.5">
        <DisclosureBadge type={showcase.disclosureType} size="lg" withHint />
        {showcase.affiliateDisclosure && (
          <p className="mt-2 text-[0.8125rem] leading-snug text-muted-foreground">
            {showcase.affiliateDisclosure}
          </p>
        )}
      </div>
    </div>
  );
}

function Block({ block, showcase }: { block: ShowcaseBlockDto; showcase: ShowcaseDetailDto }) {
  const c = block.content;
  switch (block.type) {
    case 'HERO': {
      const headline = str(c, 'headline') ?? showcase.title;
      const subline = str(c, 'subline') ?? showcase.subtitle;
      const eyebrow = str(c, 'eyebrow');
      return (
        <section className="card-elevated relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent-soft blur-3xl"
          />
          <div className="relative p-5">
            {eyebrow && (
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent-ink">
                {eyebrow}
              </p>
            )}
            <h3 className="mt-1.5 text-balance text-[1.5rem] font-bold leading-[1.1] tracking-tight text-label">
              {headline}
            </h3>
            {subline && (
              <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">{subline}</p>
            )}
          </div>
        </section>
      );
    }

    case 'PROMISE': {
      const items = strArray(c, 'items');
      if (items.length === 0) return null;
      return (
        <BlockShell title="Das Produktversprechen" icon={CheckCircle2}>
          <ul className="space-y-2.5">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[0.9375rem] leading-snug text-label">
                <CheckCircle2 className="mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0 text-positive" strokeWidth={2.3} />
                {item}
              </li>
            ))}
          </ul>
        </BlockShell>
      );
    }

    case 'AUDIENCE': {
      const items = strArray(c, 'items');
      if (items.length === 0) return null;
      return (
        <BlockShell title="Für wen ist das gedacht" icon={Users}>
          <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <span key={i} className="rounded-full bg-fill-2 px-3 py-1.5 text-[0.875rem] text-label">
                {item}
              </span>
            ))}
          </div>
        </BlockShell>
      );
    }

    case 'FEATURE_CARDS': {
      const cards = titledItems(c, 'cards');
      if (cards.length === 0) return null;
      return (
        <BlockShell title="Features" icon={Star}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {cards.map((card, i) => (
              <div key={i} className="rounded-[0.9rem] bg-fill-2 p-3.5">
                <p className="text-[0.9375rem] font-semibold text-label">{card.title}</p>
                {card.text && (
                  <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">{card.text}</p>
                )}
              </div>
            ))}
          </div>
        </BlockShell>
      );
    }

    case 'USE_CASES': {
      const items = titledItems(c, 'items');
      if (items.length === 0) return null;
      return (
        <BlockShell title="Anwendungsfälle" icon={ListChecks}>
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li key={i}>
                <p className="text-[0.9375rem] font-semibold text-label">{item.title}</p>
                {item.text && (
                  <p className="mt-0.5 text-[0.875rem] leading-snug text-muted-foreground">{item.text}</p>
                )}
              </li>
            ))}
          </ul>
        </BlockShell>
      );
    }

    case 'PROBLEM_SOLUTION': {
      const problem = str(c, 'problem');
      const solution = str(c, 'solution');
      if (!problem && !solution) return null;
      return (
        <BlockShell title="Problem & Lösung" icon={Lightbulb}>
          <div className="space-y-3">
            {problem && (
              <div className="rounded-[0.9rem] bg-regret-soft p-3.5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-regret-ink">
                  Problem
                </p>
                <p className="mt-1 text-[0.9375rem] leading-snug text-label">{problem}</p>
              </div>
            )}
            {solution && (
              <div className="rounded-[0.9rem] bg-positive-soft p-3.5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-positive-ink">
                  Lösung
                </p>
                <p className="mt-1 text-[0.9375rem] leading-snug text-label">{solution}</p>
              </div>
            )}
          </div>
        </BlockShell>
      );
    }

    case 'COMPARISON': {
      const criteria = strArray(c, 'criteria');
      const note = str(c, 'note');
      if (criteria.length === 0) return null;
      return (
        <BlockShell title="Vergleichskriterien" icon={ListChecks}>
          <div className="flex flex-wrap gap-2">
            {criteria.map((cr, i) => (
              <span key={i} className="rounded-full bg-fill-2 px-3 py-1.5 text-[0.875rem] text-label">
                {cr}
              </span>
            ))}
          </div>
          {note && <p className="mt-3 text-[0.8125rem] leading-snug text-muted-foreground">{note}</p>}
        </BlockShell>
      );
    }

    case 'TECH_SPECS': {
      const specs = specItems(c, 'specs');
      if (specs.length === 0) return null;
      return (
        <BlockShell title="Technische Daten" icon={ListChecks}>
          <dl className="divide-y divide-separator">
            {specs.map((spec, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[0.875rem] text-muted-foreground">{spec.label}</dt>
                <dd className="text-[0.9375rem] font-medium tnum text-label">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </BlockShell>
      );
    }

    case 'FAQ': {
      const items = qaItems(c, 'items');
      if (items.length === 0) return null;
      return (
        <BlockShell title="Häufige Fragen" icon={HelpCircle}>
          <div className="space-y-2">
            {items.map((item, i) => (
              <details key={i} className="group rounded-[0.9rem] bg-fill-2 px-3.5 py-2.5">
                <summary className="tap-dim flex cursor-pointer list-none items-center justify-between gap-2 text-[0.9375rem] font-medium text-label [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ArrowRight className="h-4 w-4 shrink-0 text-label-3 transition-transform group-open:rotate-90" strokeWidth={2.4} />
                </summary>
                <p className="mt-2 text-[0.875rem] leading-snug text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </BlockShell>
      );
    }

    case 'CREATOR_VERDICT': {
      const verdict = str(c, 'verdict');
      const text = str(c, 'text');
      const rating = num(c, 'rating');
      if (!verdict && !text) return null;
      return (
        <section className="card-elevated overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Quote className="h-[1.1rem] w-[1.1rem] -scale-x-100" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent-ink">
                  Creator-Fazit
                </p>
                {verdict && (
                  <h3 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-label">
                    {verdict}
                  </h3>
                )}
              </div>
            </div>
            {rating !== null && rating > 0 && (
              <div className="mt-2.5 flex gap-0.5" aria-label={`${rating} von 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={i < rating ? 'h-4 w-4 fill-unsure text-unsure' : 'h-4 w-4 text-label-4'}
                    strokeWidth={2}
                  />
                ))}
              </div>
            )}
            {text && (
              <p className="mt-2.5 text-[0.9375rem] leading-snug text-label">{text}</p>
            )}
          </div>
        </section>
      );
    }

    case 'BRAND_STATEMENT': {
      const text = str(c, 'text');
      if (!text) return null;
      return (
        <BlockShell title="Hersteller-Statement" icon={Quote}>
          <p className="text-[0.9375rem] leading-snug text-label">{text}</p>
        </BlockShell>
      );
    }

    case 'BUY_LINK': {
      const label = str(c, 'label') ?? 'Zum Shop';
      const url = str(c, 'url');
      if (!url) return null;
      return (
        <a
          href={url}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="press flex h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-accent text-[1.0625rem] font-semibold text-white shadow-[var(--shadow-glow)]"
        >
          {label}
          <ArrowRight className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.4} />
        </a>
      );
    }

    case 'CTA': {
      const label = str(c, 'label');
      const url = str(c, 'url');
      if (!label || !url) return null;
      return (
        <a
          href={url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="press flex h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-fill-2 text-[1.0625rem] font-semibold text-label"
        >
          {label}
          <ArrowRight className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.4} />
        </a>
      );
    }

    case 'AFFILIATE_NOTE': {
      const text = str(c, 'text') ?? 'Diese Seite enthält Affiliate-Links.';
      return (
        <p className="rounded-[0.9rem] bg-unsure-soft px-3.5 py-2.5 text-[0.8125rem] leading-snug text-unsure-ink">
          {text}
        </p>
      );
    }

    case 'DISCLOSURE':
      // The disclosure is already shown in the always-on header; a standalone
      // disclosure block would be redundant, so we skip it here.
      return null;

    default:
      // Unknown / not-yet-rendered block types (GALLERY, CHART, VIDEO,
      // DOWNLOADS) are skipped gracefully rather than breaking the page.
      return null;
  }
}

function BlockShell({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Star;
  children: React.ReactNode;
}) {
  return (
    <section className="card-elevated overflow-hidden">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon className="h-[1.05rem] w-[1.05rem] text-accent" strokeWidth={2.2} aria-hidden />
          <h3 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-label">
            {title}
          </h3>
        </div>
        {children}
      </div>
    </section>
  );
}
