/**
 * Typed API surface for Wudly, grouped by domain. Every method returns a shared
 * DTO type so the UI is fully typed against the backend contract.
 */
import type {
  AuthResponseDto,
  UserDto,
  ProductSummaryDto,
  ProductDetailDto,
  ProductInsightsDto,
  CreateProductResultDto,
  ExperienceDto,
  QuestionDto,
  AnswerDto,
  OwnershipDto,
  RankingEntryDto,
  MergeCandidateDto,
  ProfileSummaryDto,
  CategoryDto,
  PaginatedDto,
  NotificationListDto,
  PushTestResultDto,
  OpenQuestionDto,
  RatingInviteDto,
  PublicInviteDto,
  InvitedVoteDto,
  InvitedVotesSummaryDto,
  InviteRatingInput,
  RegisterInput,
  LoginInput,
  CreateProductInput,
  CreateExperienceInput,
  CreateQuestionInput,
  CreateAnswerInput,
  CreateOwnershipInput,
  PushSubscriptionInput,
  IdentifiedProductDto,
  EanResolutionDto,
  EnsuredProductDto,
  ExternalProductSuggestionDto,
  ProductFindResultDto,
  MyProductsDto,
  FromPhotoInput,
  RegretCheckDto,
  RegretCheckInput,
  QuickVoteInput,
  QuickVoteResultDto,
  RegretCardDto,
  CategoryOverviewDto,
  BlindSpotDto,
  ProfessionalProfileDto,
  ProfileDetailDto,
  ShowcaseSummaryDto,
  ShowcaseDetailDto,
  ShowcaseBlockDto,
  ProductTemplateDto,
  CreateProfileInput,
  UpdateProfileInput,
  CreateShowcaseInput,
  UpdateShowcaseInput,
  CreateBlockInput,
  UpdateBlockInput,
  ReorderBlocksInput,
  ExternalRatingDto,
  UpsertExternalRatingInput,
  AiPlaygroundTarget,
  AiPlaygroundReply,
  AiPlaygroundChatRequest,
  AiPlaygroundPing,
  AiPlaygroundWarmup,
  AiPlaygroundTargetId,
} from '@wudly/shared';
import { apiFetch, type RequestOptions } from './api-client';

// Re-export so existing call sites importing from '@/lib/api' keep working.
export type { RegretCardDto } from '@wudly/shared';

const qs = (params: Record<string, string | number | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
};

export const api = {
  auth: {
    register: (input: RegisterInput) =>
      apiFetch<AuthResponseDto>('/auth/register', { method: 'POST', json: input }),
    login: (input: LoginInput) =>
      apiFetch<AuthResponseDto>('/auth/login', { method: 'POST', json: input }),
    logout: () => apiFetch<{ success: true }>('/auth/logout', { method: 'POST' }),
    me: (opts?: RequestOptions) => apiFetch<UserDto>('/auth/me', opts),
  },

  categories: {
    list: (opts?: RequestOptions) => apiFetch<CategoryDto[]>('/categories', opts),
  },

  products: {
    list: (params: { take?: number; skip?: number } = {}, opts?: RequestOptions) =>
      apiFetch<PaginatedDto<ProductSummaryDto>>(`/products${qs(params)}`, opts),
    search: (q: string, take = 10, opts?: RequestOptions) =>
      apiFetch<ProductSummaryDto[]>(`/products/search${qs({ q, take })}`, opts),
    /** Real-market name suggestions (no AI) when the catalog has no hits. */
    externalSuggestions: (q: string, opts?: RequestOptions) =>
      apiFetch<ExternalProductSuggestionDto[]>(`/products/external-suggestions${qs({ q })}`, opts),
    /** Unified search: relevant catalog hits (+ market suggestions when deep). */
    find: (q: string, deep = false, opts?: RequestOptions) =>
      apiFetch<ProductFindResultDto>(`/products/find${qs(deep ? { q, deep: 1 } : { q })}`, opts),
    /** AI-identified product candidates (last step of the search cascade). */
    aiCandidates: (q: string, opts?: RequestOptions) =>
      apiFetch<ExternalProductSuggestionDto[]>(`/products/ai-candidates${qs({ q })}`, opts),
    get: (id: string, opts?: RequestOptions) => apiFetch<ProductDetailDto>(`/products/${id}`, opts),
    insights: (id: string, opts?: RequestOptions) =>
      apiFetch<ProductInsightsDto>(`/products/${id}/insights`, opts),
    similar: (id: string, opts?: RequestOptions) =>
      apiFetch<ProductSummaryDto[]>(`/products/${id}/similar`, opts),
    experiences: (id: string, opts?: RequestOptions) =>
      apiFetch<ExperienceDto[]>(`/products/${id}/experiences`, opts),
    questions: (id: string, opts?: RequestOptions) =>
      apiFetch<QuestionDto[]>(`/products/${id}/questions`, opts),
    questionSuggestions: (id: string, opts?: RequestOptions) =>
      apiFetch<{ questions: string[] }>(`/products/${id}/question-suggestions`, opts),
    create: (input: CreateProductInput) =>
      apiFetch<CreateProductResultDto>('/products', { method: 'POST', json: input }),
    /** Camera KI fallback: recognize a product from a captured photo (data URL). */
    identify: (image: string) =>
      apiFetch<IdentifiedProductDto>('/products/identify', { method: 'POST', json: { image } }),
    /** Resolve a scanned barcode (EAN/UPC) to a catalog product (auto-creates if new). */
    resolveEan: (ean: string, opts?: RequestOptions) =>
      apiFetch<EanResolutionDto>(`/products/resolve-ean${qs({ ean })}`, opts),
    /** Camera photo identification → find-or-create the product. */
    fromPhoto: (input: FromPhotoInput) =>
      apiFetch<EnsuredProductDto>('/products/from-photo', { method: 'POST', json: input }),
    /** Manual entry not in catalog → live web research → auto-create. */
    research: (query: string) =>
      apiFetch<EnsuredProductDto>('/products/research', { method: 'POST', json: { query } }),
    /** The current user's products, split into owned vs. added. */
    mine: (opts?: RequestOptions) => apiFetch<MyProductsDto>('/products/mine', opts),
    /** Pre-purchase regret check from a product query or shop URL. */
    regretCheck: (input: RegretCheckInput) =>
      apiFetch<RegretCheckDto>('/products/regret-check', { method: 'POST', json: input }),
    /** Record a swipe-deck quick vote; returns the live tally. */
    vote: (id: string, input: QuickVoteInput) =>
      apiFetch<QuickVoteResultDto>(`/products/${id}/vote`, { method: 'POST', json: input }),
  },

  experiences: {
    create: (productId: string, input: CreateExperienceInput) =>
      apiFetch<ExperienceDto>(`/products/${productId}/experiences`, {
        method: 'POST',
        json: input,
      }),
    mine: (opts?: RequestOptions) => apiFetch<ExperienceDto[]>('/me/experiences', opts),
  },

  questions: {
    create: (productId: string, input: CreateQuestionInput) =>
      apiFetch<QuestionDto>(`/products/${productId}/questions`, { method: 'POST', json: input }),
    answer: (questionId: string, input: CreateAnswerInput) =>
      apiFetch<AnswerDto>(`/questions/${questionId}/answers`, { method: 'POST', json: input }),
    markHelpful: (answerId: string) =>
      apiFetch<AnswerDto>(`/answers/${answerId}/helpful`, { method: 'PATCH' }),
  },

  invites: {
    create: (productId: string) =>
      apiFetch<RatingInviteDto>(`/products/${productId}/invites`, { method: 'POST' }),
    forProduct: (productId: string, opts?: RequestOptions) =>
      apiFetch<InvitedVotesSummaryDto>(`/products/${productId}/invited-votes`, opts),
    publicInvite: (token: string, opts?: RequestOptions) =>
      apiFetch<PublicInviteDto>(`/e/${token}`, opts),
    rate: (token: string, input: InviteRatingInput) =>
      apiFetch<InvitedVoteDto>(`/e/${token}/rate`, { method: 'POST', json: input }),
    claim: (token: string) =>
      apiFetch<{ claimed: number }>(`/e/${token}/claim`, { method: 'POST' }),
  },

  ownership: {
    create: (input: CreateOwnershipInput) =>
      apiFetch<OwnershipDto>('/ownerships', { method: 'POST', json: input }),
    mine: (opts?: RequestOptions) => apiFetch<OwnershipDto[]>('/me/ownerships', opts),
  },

  rankings: {
    topRebuy: (take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(
        `/rankings/top-rebuy${qs({ take, minExperiences })}`,
        opts,
      ),
    topRegret: (take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(
        `/rankings/top-regret${qs({ take, minExperiences })}`,
        opts,
      ),
    mostDiscussed: (take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(
        `/rankings/most-discussed${qs({ take, minExperiences })}`,
        opts,
      ),
    regretCards: (take = 6, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RegretCardDto[]>(
        `/rankings/regret-cards${qs({ take, minExperiences })}`,
        opts,
      ),
    byCategory: (slug: string, take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(
        `/rankings/category/${slug}${qs({ take, minExperiences })}`,
        opts,
      ),
    categoryOverview: (slug: string, opts?: RequestOptions) =>
      apiFetch<CategoryOverviewDto>(`/rankings/category/${slug}/overview`, opts),
    blindSpots: (opts?: RequestOptions) => apiFetch<BlindSpotDto[]>('/rankings/blind-spots', opts),
  },

  profile: {
    summary: (opts?: RequestOptions) => apiFetch<ProfileSummaryDto>('/me/profile', opts),
  },

  notifications: {
    list: (take = 30, opts?: RequestOptions) =>
      apiFetch<NotificationListDto>(`/me/notifications${qs({ take })}`, opts),
    unreadCount: (opts?: RequestOptions) =>
      apiFetch<{ count: number }>('/me/notifications/unread-count', opts),
    openQuestions: (opts?: RequestOptions) =>
      apiFetch<OpenQuestionDto[]>('/me/notifications/open-questions', opts),
    myQuestions: (opts?: RequestOptions) =>
      apiFetch<OpenQuestionDto[]>('/me/notifications/my-questions', opts),
    markRead: (id: string) => apiFetch<void>(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => apiFetch<void>('/me/notifications/read-all', { method: 'PATCH' }),
    pushKey: (opts?: RequestOptions) =>
      apiFetch<{ publicKey: string | null }>('/me/notifications/push/key', opts),
    pushSubscribe: (input: PushSubscriptionInput) =>
      apiFetch<void>('/me/notifications/push/subscribe', { method: 'POST', json: input }),
    pushUnsubscribe: (endpoint: string) =>
      apiFetch<void>('/me/notifications/push/unsubscribe', { method: 'POST', json: { endpoint } }),
    /** Self-test: send a push to the caller's own devices, report the real result. */
    pushTest: () =>
      apiFetch<PushTestResultDto>('/me/notifications/push/test', { method: 'POST' }),
  },

  /**
   * Wudly Showcase — professional creator / brand content. Clearly labelled and
   * deliberately separate from the neutral Signal score / rankings.
   */
  showcase: {
    // Profiles
    profile: (slug: string, opts?: RequestOptions) =>
      apiFetch<ProfileDetailDto>(`/profiles/${slug}`, opts),
    myProfile: (opts?: RequestOptions) =>
      apiFetch<ProfessionalProfileDto | null>('/me/profile/professional', opts),
    createProfile: (input: CreateProfileInput) =>
      apiFetch<ProfessionalProfileDto>('/profiles', { method: 'POST', json: input }),
    updateProfile: (id: string, input: UpdateProfileInput) =>
      apiFetch<ProfessionalProfileDto>(`/profiles/${id}`, { method: 'PATCH', json: input }),
    requestVerification: (id: string) =>
      apiFetch<ProfessionalProfileDto>(`/profiles/${id}/verify-request`, { method: 'POST' }),

    // Showcases
    forProduct: (productId: string, opts?: RequestOptions) =>
      apiFetch<ShowcaseSummaryDto[]>(`/products/${productId}/showcases`, opts),
    mine: (opts?: RequestOptions) => apiFetch<ShowcaseSummaryDto[]>('/me/showcases', opts),
    get: (id: string, opts?: RequestOptions) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${id}`, opts),
    create: (productId: string, input: CreateShowcaseInput) =>
      apiFetch<ShowcaseDetailDto>(`/products/${productId}/showcases`, {
        method: 'POST',
        json: input,
      }),
    update: (id: string, input: UpdateShowcaseInput) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${id}`, { method: 'PATCH', json: input }),
    publish: (id: string) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${id}/publish`, { method: 'POST' }),

    // Blocks
    addBlock: (showcaseId: string, input: CreateBlockInput) =>
      apiFetch<ShowcaseBlockDto>(`/showcases/${showcaseId}/blocks`, {
        method: 'POST',
        json: input,
      }),
    updateBlock: (blockId: string, input: UpdateBlockInput) =>
      apiFetch<ShowcaseBlockDto>(`/showcase-blocks/${blockId}`, { method: 'PATCH', json: input }),
    deleteBlock: (blockId: string) =>
      apiFetch<{ success: true }>(`/showcase-blocks/${blockId}`, { method: 'DELETE' }),
    reorderBlocks: (showcaseId: string, input: ReorderBlocksInput) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${showcaseId}/reorder-blocks`, {
        method: 'PATCH',
        json: input,
      }),

    // Templates
    templates: (opts?: RequestOptions) => apiFetch<ProductTemplateDto[]>('/templates', opts),
    templatesForCategory: (categorySlug: string, opts?: RequestOptions) =>
      apiFetch<ProductTemplateDto[]>(`/templates/category/${categorySlug}`, opts),
  },

  ai: {
    /** Admin-only model playground: list benchmarkable targets. */
    playgroundTargets: (opts?: RequestOptions) =>
      apiFetch<AiPlaygroundTarget[]>('/ai/playground/targets', opts),
    /** Admin-only: send one prompt to one target and get the answer + metrics. */
    playgroundChat: (input: AiPlaygroundChatRequest, opts?: RequestOptions) =>
      apiFetch<AiPlaygroundReply>('/ai/playground/chat', { ...opts, method: 'POST', json: input }),
    /** Admin-only: fast reachability probe for one target (Gemma: /api/tags). */
    playgroundPing: (target: AiPlaygroundTargetId, opts?: RequestOptions) =>
      apiFetch<AiPlaygroundPing>(`/ai/playground/ping?target=${encodeURIComponent(target)}`, opts),
    /** Admin-only: preload a target's model into memory (Gemma cold-start). */
    playgroundWarmup: (target: AiPlaygroundTargetId, opts?: RequestOptions) =>
      apiFetch<AiPlaygroundWarmup>('/ai/playground/warmup', {
        ...opts,
        method: 'POST',
        json: { targetId: target },
      }),
  },

  admin: {
    mergeCandidates: (opts?: RequestOptions) =>
      apiFetch<MergeCandidateDto[]>('/admin/merge-candidates', opts),
    merge: (id: string) =>
      apiFetch<{ canonicalProductId: string }>(`/admin/merge-candidates/${id}/merge`, {
        method: 'POST',
      }),
    reject: (id: string) =>
      apiFetch<{ success: true }>(`/admin/merge-candidates/${id}/reject`, { method: 'POST' }),

    // External rating facts ("Bewertungen anderswo") — facts + source link only.
    externalRatings: (productId: string, opts?: RequestOptions) =>
      apiFetch<ExternalRatingDto[]>(`/admin/products/${productId}/external-ratings`, opts),
    upsertExternalRating: (productId: string, input: UpsertExternalRatingInput) =>
      apiFetch<ExternalRatingDto>(`/admin/products/${productId}/external-ratings`, {
        method: 'POST',
        json: input,
      }),
    deleteExternalRating: (id: string) =>
      apiFetch<{ success: true }>(`/admin/external-ratings/${id}`, { method: 'DELETE' }),
  },
};
