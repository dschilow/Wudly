import type { InvitedVotesSummaryDto } from '@wudly/shared';
import { UserPlus } from 'lucide-react';

const VERDICT = {
  YES: { label: 'Wieder kaufen', cls: 'bg-positive-soft text-positive-ink' },
  NO: { label: 'Nicht nochmal', cls: 'bg-regret-soft text-regret-ink' },
  UNSURE: { label: 'Unsicher', cls: 'bg-unsure-soft text-unsure-ink' },
} satisfies Record<string, { label: string; cls: string }>;

/**
 * Invited voices — ratings left by acquaintances via an invite link. Shown
 * clearly SEPARATE from the Wudly Signal and labelled as lower-weighted, so the
 * neutral score stays trustworthy while these still add useful context.
 */
export function InvitedVotesCard({ data }: { data: InvitedVotesSummaryDto }) {
  if (data.count === 0) return null;

  return (
    <section>
      <h2 className="mono-data px-1 pb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Eingeladene Stimmen
      </h2>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.7rem] bg-accent-soft text-accent-ink">
            <UserPlus className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold leading-snug text-label">
              {data.yesCount} von {data.count} würden wieder kaufen
            </p>
            <p className="text-[0.8125rem] leading-snug text-muted-foreground">
              Von Bekannten per Einladung — separat ausgewiesen, geringer gewichtet.
            </p>
          </div>
        </div>

        <div className="divide-y divide-separator">
          {data.votes.map((v) => {
            const verdict = VERDICT[v.wouldBuyAgain] ?? VERDICT.UNSURE;
            return (
              <div key={v.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[0.875rem] font-medium text-label">
                    {v.guestName ?? 'Bekannte:r'}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${verdict.cls}`}
                  >
                    {verdict.label}
                  </span>
                </div>
                {v.comment && (
                  <p className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
                    {v.comment}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
