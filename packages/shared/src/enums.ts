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

/** Helper to turn a const-enum object into an array of its values. */
export function enumValues<T extends Record<string, string>>(e: T): Array<T[keyof T]> {
  return Object.values(e) as Array<T[keyof T]>;
}
