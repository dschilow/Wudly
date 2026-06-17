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
  ProfessionalProfileType,
  ShowcaseStatus,
  ShowcaseBlockType,
  DisclosureType,
  ExternalRatingKind,
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
  /** Owner verification mix behind this score. */
  verification: VerificationBreakdownDto;
  /** Lightweight swipe-deck signal, shown separately from the Wudly Signal. */
  quickVotes: QuickVoteResultDto;
  /** AI-written one-line summary of owner experiences (null when unavailable). */
  aiHeadline: string | null;
  /** "Wudly-empfohlen" quality seal (auto-awarded). */
  wudlySeal: boolean;
  generatedAt: string;
}

export interface VerificationBreakdownDto {
  total: number;
  verified: number;
  selfDeclared: number;
  unverified: number;
  /** Share of verified owners, 0-100. */
  verifiedShare: number;
}

/**
 * An aggregated rating FACT from another platform (average + count + link).
 * Shown in a clearly-labelled "Bewertungen anderswo" section with its source —
 * never copied texts, and never part of the Wudly Signal score.
 */
export interface ExternalRatingDto {
  id: string;
  /** Stable machine key, e.g. "amazon". */
  source: string;
  /** Display name, e.g. "Amazon". */
  sourceLabel: string;
  /** Attribution link to the source. */
  url: string;
  kind: ExternalRatingKind;
  value: number;
  maxValue: number;
  /** Number of ratings behind the value (null when unknown). */
  count: number | null;
  /** Free-text context, e.g. "Heft 5/2024". */
  note: string | null;
  fetchedAt: string;
}

/** One technical fact about a product (e.g. "Modell" → "Magic5 Pro"). */
export interface ProductSpecDto {
  label: string;
  value: string;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string | null;
  /** Technical facts from external catalogs (Icecat/UPCitemdb). May be empty. */
  specs: ProductSpecDto[];
  insights: ProductInsightsDto;
  /** Aggregated rating facts from other platforms (may be empty). */
  externalRatings: ExternalRatingDto[];
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
  /** How many people own this product — the denominator for answer progress. */
  ownerCount: number;
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

/* --- Invite-to-rate: ask an acquaintance to rate without an account --- */

export interface RatingInviteDto {
  token: string;
  /** Ready-to-share absolute URL (…/e/<token>). */
  url: string;
  productId: string;
  createdAt: string;
}

export interface PublicInviteProductDto {
  id: string;
  canonicalName: string;
  brand: string | null;
  imageUrl: string | null;
}

/** What the public, no-login rating page needs to render. */
export interface PublicInviteDto {
  token: string;
  /** false when the link is used up / expired. */
  active: boolean;
  inviterName: string | null;
  product: PublicInviteProductDto;
}

export interface InvitedVoteDto {
  id: string;
  productId: string;
  guestName: string | null;
  wouldBuyAgain: WouldBuyAgain;
  comment: string | null;
  /** true once the guest upgraded it to a real account vote. */
  claimed: boolean;
  createdAt: string;
}

export interface InvitedVotesSummaryDto {
  count: number;
  yesCount: number;
  votes: InvitedVoteDto[];
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

/**
 * A creatable product suggestion from outside the catalog — either a market
 * database hit (with EAN) or an AI-identified candidate (EAN optional).
 * Selecting one creates the product through the enrichment chain (Icecat →
 * EAN DBs → AI), so it arrives with official data, photo and specs.
 */
export interface ExternalProductSuggestionDto {
  title: string;
  brand: string | null;
  /** EAN/GTIN when the source knows it — enables the Icecat-quality path. */
  ean: string | null;
  image: string | null;
  /** Provider key for attribution, e.g. "upcitemdb" | "ai". */
  source: string;
}

/**
 * Unified search result — the server runs the whole cascade (catalog →
 * market DBs) and the client renders ONE consistent list from it.
 */
export interface ProductFindResultDto {
  /** Relevant catalog hits only (display cutoff, not the loose recall search). */
  catalog: ProductSummaryDto[];
  /** Creatable market suggestions (empty when a strong catalog match exists). */
  market: ExternalProductSuggestionDto[];
  /** True when the catalog already contains what the user is looking for. */
  hasStrongMatch: boolean;
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

/* ------------------------------------------------------------------ *
 * Wudly Showcase DTOs (professional creator / brand content).
 * Always disclosure-labelled; never part of the neutral score / rankings.
 * ------------------------------------------------------------------ */

export interface ProfessionalProfileDto {
  id: string;
  type: ProfessionalProfileType;
  displayName: string;
  slug: string;
  logoUrl: string | null;
  bio: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
  verificationStatus: VerificationStatus;
  /** Self-declared: this profile may publish paid cooperations. */
  paidPartnerships: boolean;
  createdAt: string;
}

/** A profile plus light aggregates for the public /creator/:slug page. */
export interface ProfileDetailDto extends ProfessionalProfileDto {
  showcaseCount: number;
  showcases: ShowcaseSummaryDto[];
}

export interface ShowcaseBlockDto {
  id: string;
  type: ShowcaseBlockType;
  sortOrder: number;
  /** Type-specific payload; shape is owned by the renderer. */
  content: Record<string, unknown>;
}

/** Lightweight showcase reference (cards, lists, product-page teaser). */
export interface ShowcaseSummaryDto {
  id: string;
  productId: string;
  title: string;
  subtitle: string | null;
  status: ShowcaseStatus;
  disclosureType: DisclosureType;
  /** Whether this disclosure must be flagged as commercial. */
  isCommercial: boolean;
  affiliateDisclosure: string | null;
  blockCount: number;
  profile: ProfessionalProfileDto;
  /** The product this showcase presents (for cross-linking from a profile). */
  product: ProductSummaryDto | null;
  publishedAt: string | null;
  createdAt: string;
}

/** Full showcase with all blocks, for the product-page Showcase tab. */
export interface ShowcaseDetailDto extends ShowcaseSummaryDto {
  blocks: ShowcaseBlockDto[];
}

/** A reusable, category-specific starting point for a showcase. */
export interface ProductTemplateDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: CategoryDto | null;
  /** Preset blocks: ordered { type, content } entries. */
  blocks: Array<{ type: ShowcaseBlockType; content: Record<string, unknown> }>;
}
