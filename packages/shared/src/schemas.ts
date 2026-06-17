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
  ProfessionalProfileType,
  ShowcaseStatus,
  ShowcaseBlockType,
  DisclosureType,
  ExternalRatingKind,
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

const externalRatingKindSchema = z.enum(
  enumValues(ExternalRatingKind) as [string, ...string[]],
) as z.ZodType<(typeof ExternalRatingKind)[keyof typeof ExternalRatingKind]>;

/**
 * Admin upsert of an external rating fact (keyed per product+source). The value
 * range depends on the kind, so it's checked cross-field below.
 */
export const upsertExternalRatingSchema = z
  .object({
    source: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/, 'Nur Kleinbuchstaben, Ziffern und Bindestriche'),
    sourceLabel: z.string().trim().min(2).max(60),
    url: z.string().trim().url().max(500),
    kind: externalRatingKindSchema.default(ExternalRatingKind.STARS),
    value: z.number().finite(),
    maxValue: z.number().finite().positive().max(100).default(5),
    count: z.number().int().min(0).max(100_000_000).nullable().optional(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const range =
      data.kind === ExternalRatingKind.PERCENT
        ? { min: 0, max: 100, what: '0–100' }
        : data.kind === ExternalRatingKind.GRADE_DE
          ? { min: 0.5, max: 6, what: 'Note 0,5–6,0' }
          : { min: 0, max: data.maxValue, what: `0–${data.maxValue}` };
    if (data.value < range.min || data.value > range.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `Wert muss im Bereich ${range.what} liegen`,
      });
    }
  });
export type UpsertExternalRatingInput = z.infer<typeof upsertExternalRatingSchema>;

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

/** A guest rating left via an invite link (no account required). */
export const inviteRatingSchema = z.object({
  wouldBuyAgain: wouldBuyAgainSchema,
  guestName: z.string().trim().max(60).optional(),
  comment: z.string().trim().max(600).optional(),
});
export type InviteRatingInput = z.infer<typeof inviteRatingSchema>;

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
    /** Small centered JPEG preview captured by the scanner, used as a product photo. */
    imageDataUrl: z
      .string()
      .trim()
      .min(32)
      .max(1_500_000)
      .refine((v) => v.startsWith('data:image/'), 'Erwartet eine Bild-Data-URL.')
      .optional(),
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

/* ------------------------------------------------------------------ *
 * Wudly Showcase — professional profiles, showcases, blocks, templates.
 * ------------------------------------------------------------------ */

const profileTypeSchema = z.enum(
  enumValues(ProfessionalProfileType) as [string, ...string[]],
) as z.ZodType<(typeof ProfessionalProfileType)[keyof typeof ProfessionalProfileType]>;
const showcaseStatusSchema = z.enum(
  enumValues(ShowcaseStatus) as [string, ...string[]],
) as z.ZodType<(typeof ShowcaseStatus)[keyof typeof ShowcaseStatus]>;
const showcaseBlockTypeSchema = z.enum(
  enumValues(ShowcaseBlockType) as [string, ...string[]],
) as z.ZodType<(typeof ShowcaseBlockType)[keyof typeof ShowcaseBlockType]>;
const disclosureTypeSchema = z.enum(
  enumValues(DisclosureType) as [string, ...string[]],
) as z.ZodType<(typeof DisclosureType)[keyof typeof DisclosureType]>;

/** A handful of well-known social platforms; free-form values still allowed. */
export const socialLinksSchema = z.record(z.string().trim().url().max(300)).default({});

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Nur Kleinbuchstaben, Zahlen und Bindestriche.');

export const createProfileSchema = z.object({
  type: profileTypeSchema,
  displayName: z.string().trim().min(2, 'Bitte gib einen Namen ein').max(80),
  slug: slugSchema.optional(),
  logoUrl: z.string().trim().url().max(500).optional(),
  bio: z.string().trim().max(1000).optional(),
  websiteUrl: z.string().trim().url().max(500).optional(),
  socialLinks: socialLinksSchema.optional(),
  paidPartnerships: z.boolean().optional().default(false),
});
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = createProfileSchema.partial().omit({ type: true });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Block content is type-specific. We validate it as a JSON object at the API
 * boundary (size-capped) and keep the per-type shape in the DTO/renderer layer.
 */
export const blockContentSchema = z.record(z.unknown());

export const showcaseBlockInputSchema = z.object({
  type: showcaseBlockTypeSchema,
  content: blockContentSchema.default({}),
});
export type ShowcaseBlockInput = z.infer<typeof showcaseBlockInputSchema>;

export const createShowcaseSchema = z.object({
  title: z.string().trim().min(2, 'Bitte gib einen Titel ein').max(120),
  subtitle: z.string().trim().max(200).optional(),
  disclosureType: disclosureTypeSchema,
  affiliateDisclosure: z.string().trim().max(300).optional(),
  /** Optional template to seed the block layout from. */
  templateSlug: z.string().trim().max(80).optional(),
  /** Optional initial blocks (e.g. from the template or the AI draft). */
  blocks: z.array(showcaseBlockInputSchema).max(40).optional(),
});
export type CreateShowcaseInput = z.infer<typeof createShowcaseSchema>;

export const updateShowcaseSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  subtitle: z.string().trim().max(200).optional(),
  status: showcaseStatusSchema.optional(),
  disclosureType: disclosureTypeSchema.optional(),
  affiliateDisclosure: z.string().trim().max(300).optional(),
});
export type UpdateShowcaseInput = z.infer<typeof updateShowcaseSchema>;

export const createBlockSchema = showcaseBlockInputSchema.extend({
  /** Insert position; appended to the end when omitted. */
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
export type CreateBlockInput = z.infer<typeof createBlockSchema>;

export const updateBlockSchema = z.object({
  content: blockContentSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;

export const reorderBlocksSchema = z.object({
  /** Block ids in the desired order. */
  blockIds: z.array(idSchema).min(1).max(40),
});
export type ReorderBlocksInput = z.infer<typeof reorderBlocksSchema>;
