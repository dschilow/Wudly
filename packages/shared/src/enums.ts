/**
 * Domain enums for Wudly.
 *
 * These are declared as `const` objects plus derived union types so they can be
 * used both as runtime values (e.g. iterating options in the UI) and as types.
 * They MUST stay in sync with the Prisma schema enums of the same name.
 */

export const WouldBuyAgain = {
  YES: 'YES',
  NO: 'NO',
  UNSURE: 'UNSURE',
} as const;
export type WouldBuyAgain = (typeof WouldBuyAgain)[keyof typeof WouldBuyAgain];

export const UsageDuration = {
  LESS_THAN_WEEK: 'LESS_THAN_WEEK',
  ONE_TO_FOUR_WEEKS: 'ONE_TO_FOUR_WEEKS',
  ONE_TO_SIX_MONTHS: 'ONE_TO_SIX_MONTHS',
  SIX_TO_TWELVE_MONTHS: 'SIX_TO_TWELVE_MONTHS',
  MORE_THAN_YEAR: 'MORE_THAN_YEAR',
} as const;
export type UsageDuration = (typeof UsageDuration)[keyof typeof UsageDuration];

export const ExperienceMood = {
  TOP_BUY: 'TOP_BUY',
  GOOD_DAILY_USE: 'GOOD_DAILY_USE',
  OKAY: 'OKAY',
  ANNOYING: 'ANNOYING',
  DEFECTIVE: 'DEFECTIVE',
  REGRET: 'REGRET',
  SURPRISINGLY_GOOD: 'SURPRISINGLY_GOOD',
} as const;
export type ExperienceMood = (typeof ExperienceMood)[keyof typeof ExperienceMood];

export const AspectSentiment = {
  POSITIVE: 'POSITIVE',
  NEGATIVE: 'NEGATIVE',
  NEUTRAL: 'NEUTRAL',
} as const;
export type AspectSentiment = (typeof AspectSentiment)[keyof typeof AspectSentiment];

export const QuickAnswer = {
  YES: 'YES',
  NO: 'NO',
  MOSTLY: 'MOSTLY',
  DEPENDS: 'DEPENDS',
  UNSURE: 'UNSURE',
} as const;
export type QuickAnswer = (typeof QuickAnswer)[keyof typeof QuickAnswer];

export const ProductStatus = {
  ACTIVE: 'ACTIVE',
  PENDING_REVIEW: 'PENDING_REVIEW',
  MERGED: 'MERGED',
  HIDDEN: 'HIDDEN',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const QuestionStatus = {
  OPEN: 'OPEN',
  ANSWERED: 'ANSWERED',
  CLOSED: 'CLOSED',
  HIDDEN: 'HIDDEN',
} as const;
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const VerificationStatus = {
  SELF_DECLARED: 'SELF_DECLARED',
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const ProductIdentifierType = {
  EAN: 'EAN',
  GTIN: 'GTIN',
  MPN: 'MPN',
  ASIN: 'ASIN',
  SKU: 'SKU',
  OTHER: 'OTHER',
} as const;
export type ProductIdentifierType =
  (typeof ProductIdentifierType)[keyof typeof ProductIdentifierType];

export const ProductSourceType = {
  USER_SUBMITTED: 'USER_SUBMITTED',
  MANUFACTURER: 'MANUFACTURER',
  IMPORT: 'IMPORT',
  OTHER: 'OTHER',
} as const;
export type ProductSourceType = (typeof ProductSourceType)[keyof typeof ProductSourceType];

export const CategoryAspectType = {
  POSITIVE: 'POSITIVE',
  NEGATIVE: 'NEGATIVE',
  NEUTRAL: 'NEUTRAL',
} as const;
export type CategoryAspectType = (typeof CategoryAspectType)[keyof typeof CategoryAspectType];

export const MergeCandidateStatus = {
  PENDING: 'PENDING',
  MERGED: 'MERGED',
  REJECTED: 'REJECTED',
} as const;
export type MergeCandidateStatus = (typeof MergeCandidateStatus)[keyof typeof MergeCandidateStatus];

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const NotificationType = {
  QUESTION_ASKED: 'QUESTION_ASKED',
  QUESTION_ANSWERED: 'QUESTION_ANSWERED',
  ANSWER_HELPFUL: 'ANSWER_HELPFUL',
  /** 6-month "would you buy it again?" nudge after the honeymoon phase. */
  REBUY_REMINDER: 'REBUY_REMINDER',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/* ----------------------------------------------------------------- *
 * Wudly Showcase — professional creator / brand product presentation.
 *
 * IMPORTANT product rule: Showcase content is clearly-labelled commercial /
 * creator material. It NEVER influences the neutral Wudly Signal score or the
 * rankings — those derive only from real owner experiences.
 * ----------------------------------------------------------------- */

/** Who owns a professional profile. Drives default disclosure + labelling. */
export const ProfessionalProfileType = {
  CREATOR: 'CREATOR',
  INFLUENCER: 'INFLUENCER',
  BRAND: 'BRAND',
  MERCHANT: 'MERCHANT',
  TESTER: 'TESTER',
} as const;
export type ProfessionalProfileType =
  (typeof ProfessionalProfileType)[keyof typeof ProfessionalProfileType];

export const ShowcaseStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ShowcaseStatus = (typeof ShowcaseStatus)[keyof typeof ShowcaseStatus];

/** Block types for the Showcase builder (content shape lives in the JSON payload). */
export const ShowcaseBlockType = {
  HERO: 'HERO',
  PROMISE: 'PROMISE',
  AUDIENCE: 'AUDIENCE',
  GALLERY: 'GALLERY',
  FEATURE_CARDS: 'FEATURE_CARDS',
  USE_CASES: 'USE_CASES',
  PROBLEM_SOLUTION: 'PROBLEM_SOLUTION',
  COMPARISON: 'COMPARISON',
  CHART: 'CHART',
  FAQ: 'FAQ',
  VIDEO: 'VIDEO',
  CREATOR_VERDICT: 'CREATOR_VERDICT',
  BRAND_STATEMENT: 'BRAND_STATEMENT',
  TECH_SPECS: 'TECH_SPECS',
  BUY_LINK: 'BUY_LINK',
  AFFILIATE_NOTE: 'AFFILIATE_NOTE',
  DOWNLOADS: 'DOWNLOADS',
  CTA: 'CTA',
  DISCLOSURE: 'DISCLOSURE',
} as const;
export type ShowcaseBlockType = (typeof ShowcaseBlockType)[keyof typeof ShowcaseBlockType];

/** Mandatory transparency label for any commercial / creator contribution. */
export const DisclosureType = {
  /** Self-bought, independent. */
  SELF_BOUGHT: 'SELF_BOUGHT',
  /** Received the product for free to test. */
  FREE_PRODUCT: 'FREE_PRODUCT',
  /** Paid cooperation / sponsored. */
  PAID_PARTNERSHIP: 'PAID_PARTNERSHIP',
  /** Contains affiliate links. */
  AFFILIATE: 'AFFILIATE',
  /** Official manufacturer content. */
  MANUFACTURER: 'MANUFACTURER',
  /** Official merchant / retailer content. */
  MERCHANT: 'MERCHANT',
  /** Independent creator test (no payment, may have been self-bought). */
  INDEPENDENT_TEST: 'INDEPENDENT_TEST',
  /** Native Wudly owner experience (the neutral baseline). */
  WUDLY_NATIVE: 'WUDLY_NATIVE',
} as const;
export type DisclosureType = (typeof DisclosureType)[keyof typeof DisclosureType];

/**
 * How an external rating value is expressed (drives display + normalization).
 * External ratings are aggregated FACTS from other platforms — clearly labelled
 * with their source and NEVER part of the Wudly Signal score or rankings.
 */
export const ExternalRatingKind = {
  /** e.g. 4.5 out of maxValue 5 stars. */
  STARS: 'STARS',
  /** 0–100. */
  PERCENT: 'PERCENT',
  /** German school grade 1.0 (best) – 6.0 (worst), e.g. Stiftung Warentest. */
  GRADE_DE: 'GRADE_DE',
} as const;
export type ExternalRatingKind = (typeof ExternalRatingKind)[keyof typeof ExternalRatingKind];

/** Helper to turn a const-enum object into an array of its values. */
export function enumValues<T extends Record<string, string>>(e: T): Array<T[keyof T]> {
  return Object.values(e) as Array<T[keyof T]>;
}
