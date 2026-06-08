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
  DisclosureType,
  ProfessionalProfileType,
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

/* ------------------------------------------------------------------ *
 * Wudly Showcase labels (German). Used by the disclosure badges + the
 * profile / showcase UI so wording is identical everywhere.
 * ------------------------------------------------------------------ */

export const PROFESSIONAL_PROFILE_TYPE_LABEL: Record<string, string> = {
  [ProfessionalProfileType.CREATOR]: 'Creator',
  [ProfessionalProfileType.INFLUENCER]: 'Influencer',
  [ProfessionalProfileType.BRAND]: 'Hersteller',
  [ProfessionalProfileType.MERCHANT]: 'Händler',
  [ProfessionalProfileType.TESTER]: 'Produkttester',
};

export interface DisclosureMeta {
  label: string;
  /** Short hint shown under the label. */
  hint: string;
  /** Is this a commercial / paid relationship that needs the strongest flag? */
  commercial: boolean;
  tone: 'neutral' | 'warning' | 'commercial';
}

/**
 * Transparency labels. `commercial: true` entries MUST be visibly flagged.
 * The order here is also the menu order in the editor.
 */
export const DISCLOSURE_META: Record<string, DisclosureMeta> = {
  [DisclosureType.WUDLY_NATIVE]: {
    label: 'Wudly-Besitzererfahrung',
    hint: 'Neutrale Erfahrung echter Besitzer.',
    commercial: false,
    tone: 'neutral',
  },
  [DisclosureType.SELF_BOUGHT]: {
    label: 'Selbst gekauft',
    hint: 'Unabhängig, selbst bezahlt.',
    commercial: false,
    tone: 'neutral',
  },
  [DisclosureType.INDEPENDENT_TEST]: {
    label: 'Unabhängiger Creator-Test',
    hint: 'Test ohne Bezahlung durch den Hersteller.',
    commercial: false,
    tone: 'neutral',
  },
  [DisclosureType.FREE_PRODUCT]: {
    label: 'Kostenloses Testprodukt',
    hint: 'Produkt wurde kostenlos zur Verfügung gestellt.',
    commercial: true,
    tone: 'warning',
  },
  [DisclosureType.AFFILIATE]: {
    label: 'Affiliate-Links',
    hint: 'Enthält Provisions-Links.',
    commercial: true,
    tone: 'warning',
  },
  [DisclosureType.PAID_PARTNERSHIP]: {
    label: 'Bezahlte Kooperation',
    hint: 'Bezahlter Werbeinhalt / Sponsoring.',
    commercial: true,
    tone: 'commercial',
  },
  [DisclosureType.MANUFACTURER]: {
    label: 'Herstellerinhalt',
    hint: 'Offizieller Inhalt des Herstellers.',
    commercial: true,
    tone: 'commercial',
  },
  [DisclosureType.MERCHANT]: {
    label: 'Händlerinhalt',
    hint: 'Offizieller Inhalt des Händlers.',
    commercial: true,
    tone: 'commercial',
  },
};

export const DISCLOSURE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(DISCLOSURE_META).map(([k, v]) => [k, v.label]),
);

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
