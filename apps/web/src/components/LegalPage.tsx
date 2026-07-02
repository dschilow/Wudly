import type { ReactNode } from 'react';

/**
 * Shared shell for the legal pages (Impressum/Datenschutz/AGB) — plain prose in
 * the app's card style, not indexed (these have no SEO value and shouldn't
 * compete with product/compare pages in search results).
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="animate-fade mx-auto max-w-2xl space-y-5 pb-8 pt-3">
      <div>
        <h1 className="font-display text-[2rem] leading-tight text-label">{title}</h1>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">Stand: {updated}</p>
      </div>
      <div className="card space-y-5 p-5 text-[0.9375rem] leading-relaxed text-label sm:p-6 [&_h2]:mt-6 [&_h2]:text-[1.15rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:first:mt-0 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
