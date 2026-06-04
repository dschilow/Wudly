import { Sparkles } from 'lucide-react';

/**
 * AI-written one-liner summarizing what owners say. A calm, lightly tinted card
 * with a brand-gradient glyph so it reads as a crafted highlight, not a banner.
 */
export function AiInsightCard({ headline }: { headline: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-3 p-4">
        <span className="brand-gradient grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-glow)]">
          <Sparkles className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <div className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-accent">
            Wudly fasst zusammen
          </div>
          <p className="mt-1 text-[0.9375rem] leading-snug text-label">{headline}</p>
        </div>
      </div>
    </div>
  );
}
