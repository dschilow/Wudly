/**
 * Zod schemas for API requests/responses, shared between backend and frontend.
 *
 * The backend uses these for runtime validation (via a ZodValidationPipe); the
 * frontend imports the inferred types for fully-typed fetch calls. Keeping the
 * contract here means the two can never silently drift.
 */

import { z } from 'zod';
import {
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
  AspectSentiment,
  QuickAnswer,
  enumValues,
} from './enums';

/* ------------------------------------------------------------------ *
 * Primitive / shared
 * ------------------------------------------------------------------ */

export const idSchema = z.string().min(1);

export const paginationQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

const wouldBuyAgainSchema = z.enum(enumValues(WouldBuyAgain) as [string, ...string[]]) as z.ZodType<
  (typeof WouldBuyAgain)[keyof typeof WouldBuyAgain]
>;
const usageDurationSchema = z.enum(enumValues(UsageDuration) as [string, ...string[]]) as z.ZodType<
  (typeof UsageDuration)[keyof typeof UsageDuration]
>;
const experienceMoodSchema = z.enum(
  enumValues(ExperienceMood) as [string, ...string[]],
) as z.ZodType<(typeof ExperienceMood)[keyof typeof ExperienceMood]>;
const aspectSentimentSchema = z.enum(
  enumValues(AspectSentiment) as [string, ...string[]],
) as z.ZodType<(typeof AspectSentiment)[keyof typeof AspectSentiment]>;
const quickAnswerSchema = z.enum(enumValues(QuickAnswer) as [string, ...string[]]) as z.ZodType<
  (typeof QuickAnswer)[keyof typeof QuickAnswer]
>;

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Mindestens 8 Zeichen').max(128),
  displayName: z.string().min(2).max(60).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  take: z.coerce.number().int().min(1).max(50).default(10),
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const createProductSchema = z.object({
  canonicalName: z.string().trim().min(2, 'Bitte gib einen Produktnamen ein').max(160),
  brand: z.string().trim().min(1).max(80).optional(),
  categorySlug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().max(500).optional(),
  /**
   * When the user has been shown duplicate candidates and still wants to create
   * a new product, the frontend sets this so the backend skips the soft-block.
   */
  forceCreate: z.boolean().optional().default(false),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().omit({ forceCreate: true });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/* ------------------------------------------------------------------ *
 * Ownership
 * ------------------------------------------------------------------ */

export const createOwnershipSchema = z.object({
  productId: idSchema,
  variantId: idSchema.optional(),
});
export type CreateOwnershipInput = z.infer<typeof createOwnershipSchema>;

/* ------------------------------------------------------------------ *
 * Experiences
 * ------------------------------------------------------------------ */

export const experienceAspectInputSchema = z.object({
  aspectKey: z.string().trim().min(1).max(80),
  sentiment: aspectSentimentSchema,
  severity: z.number().int().min(0).max(5).optional(),
});
export type ExperienceAspectInput = z.infer<typeof experienceAspectInputSchema>;

export const createExperienceSchema = z.object({
  wouldBuyAgain: wouldBuyAgainSchema,
  usageDuration: usageDurationSchema,
  experienceMood: experienceMoodSchema,
  wishKnownText: z.string().trim().max(1000).optional(),
  freeText: z.string().trim().max(2000).optional(),
  /** Comparative regret: what they'd have bought instead. */
  insteadOfText: z.string().trim().max(160).optional(),
  isPublic: z.boolean().default(true),
  variantId: idSchema.optional(),
  positiveAspects: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  negativeAspects: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});
export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;

/* ------------------------------------------------------------------ *
 * Questions & Answers
 * ------------------------------------------------------------------ */

export const createQuestionSchema = z.object({
  questionText: z.string().trim().min(5, 'Frage ist zu kurz').max(300),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const createAnswerSchema = z.object({
  answerText: z.string().trim().min(2, 'Antwort ist zu kurz').max(2000),
  quickAnswer: quickAnswerSchema.optional(),
});
export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;

/* ------------------------------------------------------------------ *
 * Product scan — camera KI fallback (no API key in the client)
 * ------------------------------------------------------------------ */

export const identifyProductSchema = z.object({
  /** `data:image/jpeg;base64,…` frame captured + downscaled client-side. */
  image: z
    .string()
    .trim()
    .min(32)
    .max(6_000_000)
    .refine((v) => v.startsWith('data:image/'), 'Erwartet eine Bild-Data-URL.'),
});
export type IdentifyProductInput = z.infer<typeof identifyProductSchema>;

/** Resolve a scanned barcode (EAN/UPC) to a product. */
export const eanLookupQuerySchema = z.object({
  ean: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^[0-9]+$/, 'EAN/UPC besteht nur aus Ziffern.'),
});
export type EanLookupQuery = z.infer<typeof eanLookupQuerySchema>;

/** Pre-purchase regret check from a scanned/typed product or a shop URL. */
export const regretCheckSchema = z
  .object({
    url: z.string().trim().max(2000).optional(),
    query: z.string().trim().max(160).optional(),
  })
  .refine((d) => Boolean((d.url && d.url.length > 0) || (d.query && d.query.length > 0)), {
    message: 'url oder query erforderlich.',
  });
export type RegretCheckInput = z.infer<typeof regretCheckSchema>;

/** Lightweight swipe-deck vote ("würdest du es wieder kaufen?"). */
export const quickVoteSchema = z.object({
  value: wouldBuyAgainSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
});
export type QuickVoteInput = z.infer<typeof quickVoteSchema>;

/** Manual entry → live web research → auto-create a missing product. */
export const researchProductSchema = z.object({
  query: z.string().trim().min(2).max(160),
});
export type ResearchProductInput = z.infer<typeof researchProductSchema>;

/** Web Push subscription payload (browser PushSubscription.toJSON shape). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

/** Camera photo identification → find-or-create the product (no manual data). */
export const fromPhotoSchema = z
  .object({
    brand: z.string().trim().max(80).optional(),
    product: z.string().trim().max(160).optional(),
    category: z.string().trim().max(80).optional(),
  })
  .refine((d) => (d.brand?.trim().length ?? 0) + (d.product?.trim().length ?? 0) >= 2, {
    message: 'brand oder product erforderlich.',
  });
export type FromPhotoInput = z.infer<typeof fromPhotoSchema>;

/* ------------------------------------------------------------------ *
 * Rankings
 * ------------------------------------------------------------------ */

export const rankingQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(50).default(20),
  minExperiences: z.coerce.number().int().min(0).max(100).default(1),
});
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
