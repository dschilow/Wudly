/**
 * AI-written one-liner summarizing what owners say. Calm, iOS-grouped style with a
 * subtle tinted background; only rendered when an AI headline exists.
 */
export function AiInsightCard({ headline }: { headline: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-accent-soft px-4 py-3.5">
      <div className="text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-accent">
        Zusammenfassung
      </div>
      <p className="mt-1 text-[0.9375rem] leading-snug text-label">{headline}</p>
    </div>
  );
}
