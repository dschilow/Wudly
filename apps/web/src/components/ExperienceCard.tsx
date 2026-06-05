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

/** A single owner experience as an iOS grouped card. */
export function ExperienceCard({ experience }: { experience: ExperienceDto }) {
  const buy = buyAgainMap[experience.wouldBuyAgain];
  const mood = moodMap[experience.experienceMood];

  return (
    <div className="card space-y-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-fill-2 text-[0.8125rem] font-semibold text-muted-foreground">
            {(experience.authorName ?? 'A').charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[0.9375rem] font-medium text-label">
                {experience.authorName ?? 'Besitzer'}
              </span>
              {experience.verificationStatus === 'VERIFIED' && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-positive-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-positive-ink"
                  title="Per Kamera/Barcode als echter Käufer bestätigt"
                >
                  <BadgeCheck className="h-3 w-3" strokeWidth={2.6} />
                  Echter Käufer
                </span>
              )}
            </div>
            <div className="text-[0.8125rem] text-muted-foreground">
              {USAGE_DURATION_LABEL[experience.usageDuration]}
            </div>
          </div>
        </div>
        {buy && (
          <Pill tone={toneToPill[buy.tone ?? 'neutral']}>
            {buy.emoji} {buy.label}
          </Pill>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {mood && (
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

      {experience.wishKnownText && (
        <p className="text-[0.9375rem] leading-snug text-muted-foreground">
          <span className="text-label">Vorher gut zu wissen: </span>
          {experience.wishKnownText}
        </p>
      )}

      {experience.freeText && (
        <p className="text-[0.9375rem] leading-snug text-label">{experience.freeText}</p>
      )}

      <div className="text-[0.75rem] text-faint">{formatDate(experience.createdAt)}</div>
    </div>
  );
}
