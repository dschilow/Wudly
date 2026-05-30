/**
 * Human-readable German labels for domain enums, plus emoji/option metadata for
 * the experience flow. Shared so the frontend selectors and any backend-rendered
 * summaries use identical wording.
 */

import {
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
  QuickAnswer,
  AspectSentiment,
} from './enums';
import type {
  WouldBuyAgain as WouldBuyAgainType,
  UsageDuration as UsageDurationType,
  ExperienceMood as ExperienceMoodType,
  QuickAnswer as QuickAnswerType,
} from './enums';

export interface EnumOption<T extends string> {
  value: T;
  label: string;
  emoji?: string;
  /** Optional semantic tone for color coding. */
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
  hint?: string;
}

export const WOULD_BUY_AGAIN_OPTIONS: ReadonlyArray<EnumOption<WouldBuyAgainType>> = [
  { value: WouldBuyAgain.YES, label: 'Ja', emoji: '👍', tone: 'positive' },
  { value: WouldBuyAgain.NO, label: 'Nein', emoji: '👎', tone: 'negative' },
  { value: WouldBuyAgain.UNSURE, label: 'Unsicher', emoji: '🤔', tone: 'warning' },
];

export const USAGE_DURATION_OPTIONS: ReadonlyArray<EnumOption<UsageDurationType>> = [
  { value: UsageDuration.LESS_THAN_WEEK, label: 'Weniger als 1 Woche', emoji: '⏱️' },
  { value: UsageDuration.ONE_TO_FOUR_WEEKS, label: '1 bis 4 Wochen', emoji: '📅' },
  { value: UsageDuration.ONE_TO_SIX_MONTHS, label: '1 bis 6 Monate', emoji: '🗓️' },
  { value: UsageDuration.SIX_TO_TWELVE_MONTHS, label: '6 bis 12 Monate', emoji: '📆' },
  { value: UsageDuration.MORE_THAN_YEAR, label: 'Mehr als 1 Jahr', emoji: '🏆' },
];

export const EXPERIENCE_MOOD_OPTIONS: ReadonlyArray<EnumOption<ExperienceMoodType>> = [
  { value: ExperienceMood.TOP_BUY, label: 'Top Kauf', emoji: '🤩', tone: 'positive' },
  { value: ExperienceMood.GOOD_DAILY_USE, label: 'Guter Alltag', emoji: '🙂', tone: 'positive' },
  { value: ExperienceMood.OKAY, label: 'Okay', emoji: '😐', tone: 'neutral' },
  { value: ExperienceMood.ANNOYING, label: 'Nervt', emoji: '😤', tone: 'negative' },
  { value: ExperienceMood.DEFECTIVE, label: 'Defekt', emoji: '🛠️', tone: 'negative' },
  { value: ExperienceMood.REGRET, label: 'Fehlkauf', emoji: '😞', tone: 'negative' },
  {
    value: ExperienceMood.SURPRISINGLY_GOOD,
    label: 'Überraschend gut',
    emoji: '✨',
    tone: 'positive',
  },
];

export const QUICK_ANSWER_OPTIONS: ReadonlyArray<EnumOption<QuickAnswerType>> = [
  { value: QuickAnswer.YES, label: 'Ja', tone: 'positive' },
  { value: QuickAnswer.NO, label: 'Nein', tone: 'negative' },
  { value: QuickAnswer.MOSTLY, label: 'Meistens', tone: 'positive' },
  { value: QuickAnswer.DEPENDS, label: 'Kommt drauf an', tone: 'neutral' },
  { value: QuickAnswer.UNSURE, label: 'Unsicher', tone: 'warning' },
];

export const WOULD_BUY_AGAIN_LABEL: Record<WouldBuyAgainType, string> = optionMap(
  WOULD_BUY_AGAIN_OPTIONS,
);
export const USAGE_DURATION_LABEL: Record<UsageDurationType, string> =
  optionMap(USAGE_DURATION_OPTIONS);
export const EXPERIENCE_MOOD_LABEL: Record<ExperienceMoodType, string> =
  optionMap(EXPERIENCE_MOOD_OPTIONS);
export const QUICK_ANSWER_LABEL: Record<QuickAnswerType, string> = optionMap(QUICK_ANSWER_OPTIONS);

export const ASPECT_SENTIMENT_LABEL: Record<string, string> = {
  [AspectSentiment.POSITIVE]: 'Positiv',
  [AspectSentiment.NEGATIVE]: 'Negativ',
  [AspectSentiment.NEUTRAL]: 'Neutral',
};

/** Common starter questions surfaced in the "ask owners" flow. */
export const COMMON_QUESTIONS: readonly string[] = [
  'Würdest du es nochmal kaufen?',
  'Was nervt nach mehreren Monaten?',
  'Ist es laut?',
  'Gab es Defekte?',
  'Für wen ist es nicht geeignet?',
  'Lohnt sich der Aufpreis?',
];

function optionMap<T extends string>(options: ReadonlyArray<EnumOption<T>>): Record<T, string> {
  return options.reduce(
    (acc, opt) => {
      acc[opt.value] = opt.label;
      return acc;
    },
    {} as Record<T, string>,
  );
}
