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
  PulseActionStatus,
  PulseActionPriority,
  PulseChangeType,
  PulseSignalSeverity,
  PulseConfidence,
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
  /**
   * "Netz-Konsens": average of external ratings normalized to 0–100, or null when
   * none. External facts only — shown separately, never part of the Wudly Signal.
   */
  externalAvgPercent: number | null;
  /** How many external sources back {@link externalAvgPercent}. */
  externalSourceCount: number;
}

/**
 * A worthwhile head-to-head pairing: the two strongest same-category products
 * with actual signal (owner data or Netz-Konsens) — the basis for pre-rendered
 * `/vergleich/x-vs-y` SEO pages. Never includes cold, data-less products.
 */
export interface ComparePairDto {
  a: ProductSummaryDto;
  b: ProductSummaryDto;
  categoryName: string | null;
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

export interface ExternalConsensusThemeDto {
  label: string;
  sourceUrls: string[];
}

/**
 * A product public reviewers say they switched to (or recommend instead),
 * with the reason and source link(s). `productId` is set when the alternative
 * could be matched to an existing catalog product (enables deep-link + compare).
 */
export interface SwitchAlternativeDto {
  name: string;
  brand: string | null;
  reason: string;
  sourceUrls: string[];
  productId: string | null;
}

/** Public-review themes, source-backed and strictly separate from Wudly owner data. */
export interface ExternalConsensusDto {
  summary: string | null;
  /** 1–2 sentences on durability/long-term reports from public sources. */
  longTermNote: string | null;
  positiveThemes: ExternalConsensusThemeDto[];
  negativeThemes: ExternalConsensusThemeDto[];
  switchAlternatives: SwitchAlternativeDto[];
  sourceUrls: string[];
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
  /** Cached public-review themes; null until researched. */
  externalConsensus: ExternalConsensusDto | null;
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

/** One aggregated owner answer to a prompt: the label and how many owners gave it. */
export interface ProductPromptAnswerStatDto {
  label: string;
  count: number;
}

/**
 * A stored, product-specific question with quick answers — the shared pool that
 * drives the owner "Ich besitze es" wizard (tap a quick answer), the buyer
 * ask-suggestions, and the "Das sagen Besitzer" aggregate on the product page.
 * Product knowledge only — never part of the Wudly Signal.
 */
export interface ProductPromptDto {
  id: string;
  questionText: string;
  /** Suggested short answers an owner can tap (empty = open/free-text question). */
  quickAnswers: string[];
  /** Where it came from: ai | curated | user. */
  source: string;
  /** How many owners have answered this prompt. */
  responseCount: number;
  /** Aggregated owner answers, most-given first (empty until answered). */
  answerStats: ProductPromptAnswerStatDto[];
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

/** A product that has no cached photo yet — the admin "fehlt warum" overview. */
export interface ImagelessProductDto {
  id: string;
  canonicalName: string;
  brand: string | null;
  categoryName: string | null;
  /** When the product was added (so the oldest gaps are obvious). */
  createdAt: string;
  /** Whether a previous hunt left a (broken / external) imageUrl behind. */
  hasStaleImageUrl: boolean;
}

/** One product's result inside an image-backfill run. */
export interface ImageBackfillResultDto {
  productId: string;
  name: string;
  /** The hunt stage that produced the stored image (e.g. "google-images"), or null. */
  storedVia: string | null;
  /** Whether a real photo was found and cached in this pass. */
  found: boolean;
  /** Short reason when nothing was found (e.g. "cse-off", "no-candidates"). */
  reason: string | null;
}

/** Summary of an image-backfill run over the imageless products. */
export interface ImageBackfillReportDto {
  /** How many products were attempted in this pass. */
  attempted: number;
  /** How many ended up with a freshly cached photo. */
  found: number;
  /** True when Google CSE isn't configured (the most reliable hunt stage is off). */
  cseConfigured: boolean;
  /** How many imageless products remain after this pass (capped count). */
  remaining: number;
  results: ImageBackfillResultDto[];
}

/** One product's result inside an external-ratings backfill run. */
export interface RatingBackfillResultDto {
  productId: string;
  name: string;
  /** How many rating facts were researched + stored for this product. */
  found: number;
  /** Number of recurring experience themes stored. */
  themes: number;
  /** True when a still-fresh cache avoided a paid research call. */
  cached: boolean;
  /** Error message when the AI research threw, else null. */
  error: string | null;
}

/** Summary of an external-ratings backfill run over products that had none. */
export interface RatingBackfillReportDto {
  /** How many products were attempted in this pass. */
  attempted: number;
  /** How many products ended up with at least one rating. */
  withRatings: number;
  /** Total rating facts stored across all attempted products. */
  totalFound: number;
  /** How many products without ratings remain after this pass. */
  remaining: number;
  results: RatingBackfillResultDto[];
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

/** A question enriched for the current user's notification inbox. */
export interface InboxQuestionDto extends QuestionDto {
  answeredByMe: boolean;
  canAnswer: boolean;
}

/** All notification and Q&A activity for one product, kept together in the inbox. */
export interface NotificationProductGroupDto {
  product: ProductSummaryDto;
  notifications: NotificationDto[];
  questions: InboxQuestionDto[];
  unreadCount: number;
  latestAt: string;
}

export interface GroupedNotificationInboxDto {
  groups: NotificationProductGroupDto[];
  ungrouped: NotificationDto[];
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

export interface ProductCurationWebResultDto {
  title: string;
  url: string;
  description: string;
  snippets: string[];
}

export interface ProductCurationDraftDto {
  title: string;
  brand: string | null;
  ean: string | null;
  image: string | null;
  description: string | null;
  specs: ProductSpecDto[];
  source: string;
}

export interface ProductCurationResearchDto {
  catalog: ProductSummaryDto[];
  market: ExternalProductSuggestionDto[];
  productSources: ProductCurationWebResultDto[];
  ratingSources: ProductCurationWebResultDto[];
  imageUrl: string | null;
  searchEnabled: boolean;
}
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

/**
 * What the browser extension gets back for a sighting/lookup:
 * - "known": the product is in the catalog — render the full signal.
 * - "queued": not in the catalog yet; the staged pipeline will pick it up.
 * - "rejected": failed a quality gate (junk title etc.) — render nothing.
 */
export interface SightingResolutionDto {
  status: 'known' | 'queued' | 'rejected';
  product: ProductSummaryDto | null;
  /** Absolute Wudly product page URL, when known. */
  webUrl: string | null;
}

/** Admin observability for the extension ingestion pipeline. */
export interface SightingStatsDto {
  total: number;
  byStatus: Record<string, number>;
  /** Most-demanded sightings still waiting for a catalog product. */
  topPending: Array<{
    dedupeKey: string;
    title: string;
    domain: string;
    seenCount: number;
    engageCount: number;
    lastSeenAt: string;
  }>;
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

/* ------------------------------------------------------------------ *
 * Wudly Pulse — B2B product-health dashboard DTOs.
 *
 * Pulse derives everything from the neutral signal data (experiences,
 * votes, insight snapshots) and answers four questions for every number:
 * what changed, why, who is affected, and what to do next. Every metric
 * carries a confidence level so thin data is never oversold.
 * ------------------------------------------------------------------ */

export interface PulseAccessDto {
  allowed: boolean;
  /** Why access is denied (null when allowed). */
  reason: 'NO_PROFILE' | 'WRONG_TYPE' | null;
  profile: ProfessionalProfileDto | null;
}

/** Windowed before/after comparison of a 0–100 score. */
export interface PulseTrendDto {
  /** Score in the selected window (null = not enough data in the window). */
  current: number | null;
  /** Score in the equally long window right before it. */
  previous: number | null;
  /** current − previous in points (null when either side is missing). */
  delta: number | null;
}

export interface PulseProductMetricsDto {
  product: ProductSummaryDto;
  /** Watchlist row id when this is a portfolio product (enables unwatch / competitor mapping). */
  watchId: string | null;
  /** Product Health Index 0–100: rebuy minus a regret penalty (see API docs). */
  healthIndex: number | null;
  rebuyScore: number | null;
  regretScore: number | null;
  /** Rebuy score, selected window vs. previous window. */
  trend: PulseTrendDto;
  confidence: PulseConfidence;
  /** All-time public owner experiences. */
  experienceCount: number;
  /** New public experiences inside the selected window. */
  newExperiences: number;
  /** Share of verified owners, 0–100. */
  verifiedShare: number;
  /** Long-term experiences (≥ 6 months of ownership). */
  longTermCount: number;
  /** Dominant ownership duration, human-readable (e.g. "meist über 1 Jahr"). */
  typicalOwnership: string | null;
}

/** A derived early-warning / positive signal. Computed live, never persisted. */
export interface PulseSignalDto {
  /** Stable derived id `${kind}:${productId}` for client-side dedupe. */
  id: string;
  kind: string;
  severity: PulseSignalSeverity;
  title: string;
  /** Understandable, complete sentence(s) — no metric jargon. */
  description: string;
  productId: string;
  productName: string;
  metricLabel: string | null;
  deltaPoints: number | null;
  /** Most important driver (e.g. the top rising negative aspect). */
  cause: string | null;
  /** Affected owner group — only honest cohorts Wudly really knows. */
  segment: string | null;
  recommendation: string;
  confidence: PulseConfidence;
  periodDays: number;
}

export interface PulseOverviewDto {
  periodDays: number;
  generatedAt: string;
  /** Portfolio Product Health Index (experience-weighted). */
  healthIndex: number | null;
  healthTrend: PulseTrendDto;
  /** Portfolio rebuy score (experience-weighted). */
  rebuyScore: number | null;
  rebuyTrend: PulseTrendDto;
  productCount: number;
  experienceCount: number;
  longTermExperienceCount: number;
  verifiedShare: number;
  /** Products with at least one critical/relevant signal. */
  attentionProductCount: number;
  criticalSignalCount: number;
  /** "Benötigt jetzt Aufmerksamkeit" — worst first. */
  attention: PulseSignalDto[];
  /** "Was läuft gut?" */
  positives: PulseSignalDto[];
  confidence: PulseConfidence;
}

export interface PulseCurvePointDto {
  bucket: UsageDuration;
  /** e.g. "nach 6–12 Monaten". */
  label: string;
  rebuyScore: number | null;
  count: number;
}

export interface PulseSegmentStatDto {
  key: string;
  /** Honest cohort labels only (verification, ownership duration, variant, guest votes). */
  label: string;
  rebuyScore: number | null;
  count: number;
  tone: 'positive' | 'negative' | 'neutral';
}

/** A concrete problem theme and how it is developing across windows. */
export interface PulseIssueDto {
  key: string;
  label: string;
  /** Mentions in the selected window. */
  count: number;
  /** Mentions in the window before it. */
  previousCount: number;
  trend: 'new' | 'rising' | 'stable' | 'falling';
}

export interface PulseProduct360Dto {
  metrics: PulseProductMetricsDto;
  variantNames: string[];
  /** Long-term satisfaction by real ownership-duration buckets. */
  curve: PulseCurvePointDto[];
  strengths: AspectStatDto[];
  /** Top reasons owners would NOT buy again. */
  regretReasons: AspectStatDto[];
  /** Problems that are new or clearly increasing in the selected window. */
  emergingIssues: PulseIssueDto[];
  segments: PulseSegmentStatDto[];
  suitedFor: string[];
  notSuitedFor: string[];
  aiHeadline: string | null;
  /** "Hätte lieber X gekauft" highlights. */
  insteadOfHighlights: string[];
  wishKnownHighlights: string[];
  signals: PulseSignalDto[];
  recentVoices: PulseFeedbackItemDto[];
  externalAvgPercent: number | null;
  externalSourceCount: number;
}

export interface PulseCompetitorEntryDto {
  /** PulseCompetitor row id (for removal). */
  id: string;
  metrics: PulseProductMetricsDto;
  strengths: AspectStatDto[];
  regretReasons: AspectStatDto[];
}

export interface PulseCompetitorSetDto {
  watchId: string;
  own: PulseProductMetricsDto;
  ownStrengths: AspectStatDto[];
  ownRegretReasons: AspectStatDto[];
  competitors: PulseCompetitorEntryDto[];
  /** Plain-language verdict: where the own product wins / loses. */
  verdict: string | null;
  /** Same-category candidates not yet mapped as competitors. */
  suggestions: ProductSummaryDto[];
}

export interface PulseActionDto {
  id: string;
  productId: string;
  productName: string;
  title: string;
  triggerSummary: string | null;
  triggerKey: string | null;
  assignee: string | null;
  priority: PulseActionPriority;
  status: PulseActionStatus;
  goal: string | null;
  expectedImpact: string | null;
  dueAt: string | null;
  baselineRebuyScore: number | null;
  baselineRegretScore: number | null;
  baselineExperienceCount: number;
  /** Live scores now — honest before/after view of the measure's effect. */
  currentRebuyScore: number | null;
  currentRegretScore: number | null;
  newExperiencesSinceCreation: number;
  /** currentRebuy − baselineRebuy (null when either side is missing). */
  effectDelta: number | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PulseChangeWindowDto {
  rebuyScore: number | null;
  regretScore: number | null;
  count: number;
}

export interface PulseChangeImpactDto {
  /** Symmetric compare window in days around `effectiveAt`. */
  windowDays: number;
  before: PulseChangeWindowDto;
  after: PulseChangeWindowDto;
  rebuyDelta: number | null;
  /** Negative themes that clearly went down after the change. */
  improvedIssues: PulseIssueDto[];
  /** Negative themes still present after the change. */
  persistingIssues: PulseIssueDto[];
  /** Negative themes that only appeared after the change. */
  newIssues: PulseIssueDto[];
  confidence: PulseConfidence;
  /** One honest German sentence summarizing the effect. */
  summary: string;
}

export interface PulseChangeDto {
  id: string;
  productId: string;
  productName: string;
  type: PulseChangeType;
  title: string;
  description: string | null;
  effectiveAt: string;
  createdAt: string;
  impact: PulseChangeImpactDto | null;
}

/** One anonymized owner voice for the B2B feedback view. */
export interface PulseFeedbackItemDto {
  id: string;
  productId: string;
  productName: string;
  variantName: string | null;
  wouldBuyAgain: WouldBuyAgain;
  usageDuration: UsageDuration;
  experienceMood: ExperienceMood;
  verificationStatus: VerificationStatus;
  freeText: string | null;
  wishKnownText: string | null;
  insteadOfText: string | null;
  aspects: ExperienceAspectDto[];
  createdAt: string;
}

export interface PulseFeedbackSummaryDto {
  positiveThemes: AspectStatDto[];
  negativeThemes: AspectStatDto[];
  /** Themes that are new in the selected window. */
  newThemes: PulseIssueDto[];
  /** "Hätte ich vorher gewusst…" highlights across the portfolio. */
  wishes: string[];
  /** Central verbatim quotes (short, anonymized). */
  quotes: string[];
  /** Per-product AI one-liners from the insight snapshots (no extra AI spend). */
  aiHeadlines: Array<{ productId: string; productName: string; headline: string }>;
}

export interface PulseFeedbackPageDto {
  items: PulseFeedbackItemDto[];
  total: number;
  summary: PulseFeedbackSummaryDto;
}

export type PulseReportType = 'health' | 'executive' | 'longterm' | 'competition' | 'actions';

export interface PulseReportMetricDto {
  label: string;
  value: string;
  delta?: number | null;
}

export interface PulseReportSectionDto {
  title: string;
  /** Clear management statements — complete sentences, no chart required. */
  statements: string[];
  metrics: PulseReportMetricDto[];
}

export interface PulseReportDto {
  type: PulseReportType;
  title: string;
  periodDays: number;
  generatedAt: string;
  intro: string;
  sections: PulseReportSectionDto[];
}

export interface PulseWorkspaceDto {
  profile: ProfessionalProfileDto;
  periodDays: number;
  products: PulseProductMetricsDto[];
}
