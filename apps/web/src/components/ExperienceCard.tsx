import type { ExperienceDto } from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  USAGE_DURATION_LABEL,
  EXPERIENCE_MOOD_OPTIONS,
} from '@wudly/shared';
import { BadgeCheck } from 'lucide-react';
import { Pill } from './ui/Pill';
import { formatDate } from '@/lib/utils';

const buyAgainMap = Object.fromEntries(WOULD_BUY_AGAIN_OPTIONS.map((o) => [o.value, o]));
const moodMap = Object.fromEntries(EXPERIENCE_MOOD_OPTIONS.map((o) => [o.value, o]));

const toneToPill = {
  positive: 'positive',
  negative: 'negative',
  warning: 'unsure',
  neutral: 'neutral',
} as const;

/**
 * A "Stimme" — one owner's experience, quote-first like a magazine pull quote:
 * the owner's words lead in serif italic, the metadata follows as a mono
 * receipt line. The verdict chip sits on the meta line, not above the text.
 */
export function ExperienceCard({ experience }: { experience: ExperienceDto }) {
  const buy = buyAgainMap[experience.wouldBuyAgain];
  const mood = moodMap[experience.experienceMood];
  const lead = experience.freeText ?? experience.wishKnownText;

  return (
    <article className="card p-4">
      {lead ? (
        <p className="font-display text-[1.25rem] italic leading-snug text-label">
          »{lead}«
        </p>
      ) : (
        mood && (
          <p className="font-display text-[1.25rem] italic leading-snug text-label">
            {mood.emoji} {mood.label}
          </p>
        )
      )}

      {experience.freeText && experience.wishKnownText && (
        <p className="mt-2 text-[0.9375rem] leading-snug text-muted-foreground">
          <span className="font-medium text-label">Vorher gut zu wissen: </span>
          {experience.wishKnownText}
        </p>
      )}

      {(experience.aspects.length > 0 || (lead && mood)) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lead && mood && (
            <Pill tone={toneToPill[mood.tone ?? 'neutral']}>
              {mood.emoji} {mood.label}
            </Pill>
          )}
          {experience.aspects.map((a) => (
            <Pill
              key={`${a.aspectKey}-${a.sentiment}`}
              tone={
                a.sentiment === 'POSITIVE'
                  ? 'positive'
                  : a.sentiment === 'NEGATIVE'
                    ? 'negative'
                    : 'neutral'
              }
            >
              {a.label}
            </Pill>
          ))}
        </div>
      )}

      <div className="hairline mt-3.5" aria-hidden />

      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="mono-data flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground">
          <span className="shrink-0 font-semibold text-label">
            {experience.authorName ?? 'Besitzer'}
          </span>
          {experience.verificationStatus === 'VERIFIED' && (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-positive-ink"
              strokeWidth={2.4}
              aria-label="Per Kamera/Barcode als echter Käufer bestätigt"
            />
          )}
          <span aria-hidden>·</span>
          <span className="shrink-0">{USAGE_DURATION_LABEL[experience.usageDuration]}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatDate(experience.createdAt)}</span>
        </p>
        {buy && (
          <Pill tone={toneToPill[buy.tone ?? 'neutral']} className="shrink-0">
            {buy.emoji} {buy.label}
          </Pill>
        )}
      </div>
    </article>
  );
}
