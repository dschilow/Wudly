/**
 * Response DTO shapes returned by the Wudly API.
 *
 * These are hand-written (not Prisma types) so the public API contract is stable
 * and decoupled from the database schema. The backend maps Prisma rows → these;
 * the frontend consumes them directly.
 */

import type {
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
  AspectSentiment,
  QuickAnswer,
  QuestionStatus,
  ProductStatus,
  MergeCandidateStatus,
  UserRole,
  NotificationType,
  VerificationStatus,
} from './enums';
import type { UsageDurationStats } from './scoring';

export interface UserDto {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponseDto {
  user: UserDto;
  /** Access token is also set as an HttpOnly cookie; returned for non-browser clients. */
  accessToken: string;
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryAspectDto {
  id: string;
  key: string;
  label: string;
  type: string;
}

export interface AspectStatDto {
  key: string;
  label: string;
  count: number;
  sentiment: AspectSentiment;
}

export interface ProductSummaryDto {
  id: string;
  canonicalName: string;
  brand: string | null;
  category: CategoryDto | null;
  imageUrl: string | null;
  status: ProductStatus;
  rebuyScore: number | null;
  regretScore: number | null;
  ownerCount: number;
  experienceCount: number;
  /** "Wudly-empfohlen" quality seal (auto-awarded). */
  wudlySeal: boolean;
}

export interface ProductInsightsDto {
  productId: string;
  ownerCount: number;
  experienceCount: number;
  rebuyScore: number | null;
  regretScore: number | null;
  unsureScore: number | null;
  topPositiveAspects: AspectStatDto[];
  topNegativeAspects: AspectStatDto[];
  wishKnownHighlights: string[];
  usageDurationStats: UsageDurationStats;
  /** Lightweight derived audience hints for "for whom (not) suited". */
  suitedFor: string[];
  notSuitedFor: string[];
  /** Share of owners (0–100) who named an alternative they'd rather have bought. */
  insteadOfShare: number;
  /** Most-named alternatives, "would rather have bought" (most frequent first). */
  insteadOfHighlights: string[];
  /** AI-written one-line summary of owner experiences (null when unavailable). */
  aiHeadline: string | null;
  /** "Wudly-empfohlen" quality seal (auto-awarded). */
  wudlySeal: boolean;
  generatedAt: string;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string | null;
  insights: ProductInsightsDto;
}

export interface ExperienceAspectDto {
  aspectKey: string;
  label: string;
  sentiment: AspectSentiment;
  severity: number | null;
}

export interface ExperienceDto {
  id: string;
  productId: string;
  /** Product display name (null on endpoints that don't join the product). */
  productName: string | null;
  userId: string;
  authorName: string | null;
  wouldBuyAgain: WouldBuyAgain;
  usageDuration: UsageDuration;
  experienceMood: ExperienceMood;
  /** Owner trust level — drives the "echter Käufer" badge + score weighting. */
  verificationStatus: VerificationStatus;
  wishKnownText: string | null;
  freeText: string | null;
  /** Comparative regret: what they'd have bought instead. */
  insteadOfText: string | null;
  isPublic: boolean;
  aspects: ExperienceAspectDto[];
  createdAt: string;
}

export interface AnswerDto {
  id: string;
  questionId: string;
  answeredByUserId: string;
  authorName: string | null;
  answerText: string;
  quickAnswer: QuickAnswer | null;
  helpfulCount: number;
  createdAt: string;
}

export interface QuestionDto {
  id: string;
  productId: string;
  askedByUserId: string | null;
  authorName: string | null;
  questionText: string;
  status: QuestionStatus;
  answers: AnswerDto[];
  answerCount: number;
  createdAt: string;
}

export interface OwnershipDto {
  id: string;
  productId: string;
  product: ProductSummaryDto | null;
  variantId: string | null;
  verificationStatus: string;
  createdAt: string;
}

export interface RankingEntryDto {
  rank: number;
  product: ProductSummaryDto;
  /** The metric this ranking is sorted by (rebuy/regret/discussion count). */
  metricValue: number;
}

export interface RegretCardDto {
  id: string;
  product: ProductSummaryDto;
  quote: string;
  regretScore: number | null;
  ownerCount: number;
}

/** One category's systematic "blind spot" for the Regret-Radar section. */
export interface BlindSpotDto {
  category: CategoryDto;
  blindSpot: string;
  productCount: number;
  averageRegretScore: number | null;
}

/** SEO category landing page payload: top picks, flops, averages, blind spot. */
export interface CategoryOverviewDto {
  category: CategoryDto;
  productCount: number;
  /** Average rebuy score across rated products in the category (null when none). */
  averageRebuyScore: number | null;
  /** Highest rebuy first. */
  top: ProductSummaryDto[];
  /** Highest regret first. */
  flops: ProductSummaryDto[];
  /** Number of products carrying the Wudly seal in this category. */
  sealCount: number;
  /** The category's "blind spot" — what owners most often wish they'd known. */
  blindSpot: string | null;
}

export interface MergeCandidateDto {
  id: string;
  productA: ProductSummaryDto;
  productB: ProductSummaryDto;
  score: number;
  reason: string | null;
  status: MergeCandidateStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ProfileSummaryDto {
  user: UserDto;
  productCount: number;
  experienceCount: number;
  answerCount: number;
  helpfulReceived: number;
}

/** Returned by POST /products when duplicate candidates were detected. */
export interface ProductMatchSuggestionDto {
  created: false;
  reason: 'possible_duplicates';
  candidates: Array<{ product: ProductSummaryDto; similarity: number }>;
}

export interface ProductCreatedDto {
  created: true;
  product: ProductDetailDto;
}

export type CreateProductResultDto = ProductCreatedDto | ProductMatchSuggestionDto;

/** Standard error envelope returned by the API exception filter. */
export interface ApiErrorDto {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
}

export interface PaginatedDto<T> {
  items: T[];
  total: number;
  take: number;
  skip: number;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  productId: string | null;
  questionId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListDto {
  items: NotificationDto[];
  unreadCount: number;
}

/** Per-device outcome of a push self-test (endpoint redacted to a short tail). */
export interface PushTestSubResultDto {
  ok: boolean;
  statusCode: number | null;
  endpoint: string;
  error?: string;
  pruned?: boolean;
}

/** Result of POST /me/notifications/push/test — what actually happened on send. */
export interface PushTestResultDto {
  /** Whether the server has VAPID configured at all. */
  enabled: boolean;
  /** How many push subscriptions the user currently has stored. */
  subscriptions: number;
  /** How many of those accepted the test push. */
  sent: number;
  results: PushTestSubResultDto[];
}

/** An unanswered question on a product the current user owns — drives the "answer the owner" loop. */
export interface OpenQuestionDto {
  question: QuestionDto;
  product: ProductSummaryDto;
}

/** Result of the camera KI fallback: a recognized product plus a ready search query. */
export interface IdentifiedProductDto {
  brand: string | null;
  product: string | null;
  category: string | null;
  /** Model confidence, 0..1. 0 means nothing usable was recognized. */
  confidence: number;
  /** Best-effort search string ("Brand Product"); empty when nothing recognized. */
  query: string;
}

/** Result of resolving a scanned barcode against the catalog / an EAN database. */
export interface EanResolutionDto {
  ean: string;
  /** Matched OR auto-created catalog product. */
  product: ProductSummaryDto | null;
  /** External lookup hit (e.g. UPCitemdb) to prefill search/add when unknown. */
  suggestion: { title: string; brand: string | null } | null;
}

/** Find-or-create result for photo / research product entry points. */
export interface EnsuredProductDto {
  product: ProductSummaryDto | null;
  created: boolean;
}

/** The current user's products, split by how they relate to them. */
export interface MyProductsDto {
  /** Products the user owns / has reviewed. */
  owned: ProductSummaryDto[];
  /** Products the user added to Wudly (and doesn't already own). */
  created: ProductSummaryDto[];
}

/** Result of the pre-purchase regret check. */
export interface RegretCheckDto {
  productId: string | null;
  productName: string | null;
  /** % of owners who would buy again (0..100), or null when unknown. */
  rebuyProbability: number | null;
  /** Most common reservation, e.g. "Lautstärke". */
  topConcern: string | null;
  summary: string;
  source: 'catalog' | 'ai' | 'none';
}

/** Aggregated swipe-deck quick votes for a product. */
export interface QuickVoteResultDto {
  /** % YES among YES/NO quick votes, or null when there are none. */
  rebuy: number | null;
  count: number;
  yes: number;
  no: number;
}
