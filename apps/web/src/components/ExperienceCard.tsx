import type { ExperienceDto } from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  USAGE_DURATION_LABEL,
  EXPERIENCE_MOOD_OPTIONS,
} from '@wudly/shared';
import { Card } from './ui/Card';
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

/** A single owner experience as shown on the product page. */
export function ExperienceCard({ experience }: { experience: ExperienceDto }) {
  const buy = buyAgainMap[experience.wouldBuyAgain];
  const mood = moodMap[experience.experienceMood];

  return (
    <Card padded className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-ink">
            {(experience.authorName ?? 'A').charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">
              {experience.authorName ?? 'Besitzer'}
            </div>
            <div className="text-xs text-muted-foreground">
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
          <Pill key={`${a.aspectKey}-${a.sentiment}`} tone={a.sentiment === 'POSITIVE' ? 'positive' : a.sentiment === 'NEGATIVE' ? 'negative' : 'neutral'}>
            {a.sentiment === 'POSITIVE' ? '+' : a.sentiment === 'NEGATIVE' ? '–' : '·'} {a.label}
          </Pill>
        ))}
      </div>

      {experience.wishKnownText && (
        <div className="rounded-[var(--radius-md)] border-l-2 border-unsure bg-unsure-soft/40 px-3.5 py-2.5 text-sm text-unsure-ink">
          <span className="font-semibold">Hätte ich vorher gewusst: </span>
          {experience.wishKnownText}
        </div>
      )}

      {experience.freeText && (
        <p className="text-sm leading-relaxed text-ink/90">{experience.freeText}</p>
      )}

      <div className="text-[0.7rem] text-muted-foreground">{formatDate(experience.createdAt)}</div>
    </Card>
  );
}
