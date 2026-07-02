/** Typed API surface for the native Wudly app. Mirrors apps/web/src/lib/api.ts. */
import type {
  AuthResponseDto,
  UserDto,
  ProductSummaryDto,
  ProductDetailDto,
  ProductInsightsDto,
  CreateProductResultDto,
  ExperienceDto,
  QuestionDto,
  ProductPromptDto,
  AnswerDto,
  OwnershipDto,
  RankingEntryDto,
  MergeCandidateDto,
  ProfileSummaryDto,
  CategoryDto,
  CategoryOverviewDto,
  PaginatedDto,
  ComparePairDto,
  NotificationListDto,
  GroupedNotificationInboxDto,
  PushTestResultDto,
  OpenQuestionDto,
  RegisterInput,
  LoginInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  CreateProductInput,
  CreateCuratedProductInput,
  CreateExperienceInput,
  CreateQuestionInput,
  CreateAnswerInput,
  CreateOwnershipInput,
  PushSubscriptionInput,
  CategoryAspectDto,
  IdentifiedProductDto,
  EanResolutionDto,
  EnsuredProductDto,
  ExternalProductSuggestionDto,
  ProductCurationResearchDto,
  ProductCurationDraftDto,
  ProductFindResultDto,
  MyProductsDto,
  FromPhotoInput,
  RegretCheckDto,
  RegretCheckInput,
  QuickVoteInput,
  QuickVoteResultDto,
  RegretCardDto,
  BlindSpotDto,
  ShowcaseSummaryDto,
  ShowcaseDetailDto,
  ShowcaseBlockDto,
  ProductTemplateDto,
  ProfessionalProfileDto,
  ProfileDetailDto,
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
  ImagelessProductDto,
  ImageBackfillReportDto,
  RatingBackfillReportDto,
  RatingInviteDto,
  PublicInviteDto,
  InvitedVotesSummaryDto,
} from '@wudly/shared';
import { apiFetch, type RequestOptions } from './api-client';

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
    requestPasswordReset: (input: RequestPasswordResetInput) =>
      apiFetch<{ success: true }>('/auth/request-password-reset', { method: 'POST', json: input }),
    resetPassword: (input: ResetPasswordInput) =>
      apiFetch<{ success: true }>('/auth/reset-password', { method: 'POST', json: input }),
  },

  categories: {
    list: (opts?: RequestOptions) => apiFetch<CategoryDto[]>('/categories', opts),
    aspects: (opts?: RequestOptions) =>
      apiFetch<Record<string, CategoryAspectDto[]>>('/categories/aspects', opts),
  },

  products: {
    list: (params: { take?: number; skip?: number } = {}, opts?: RequestOptions) =>
      apiFetch<PaginatedDto<ProductSummaryDto>>(`/products${qs(params)}`, opts),
    search: (q: string, take = 10, opts?: RequestOptions) =>
      apiFetch<ProductSummaryDto[]>(`/products/search${qs({ q, take })}`, opts),
    externalSuggestions: (q: string, opts?: RequestOptions) =>
      apiFetch<ExternalProductSuggestionDto[]>(`/products/external-suggestions${qs({ q })}`, opts),
    find: (q: string, deep = false, opts?: RequestOptions) =>
      apiFetch<ProductFindResultDto>(`/products/find${qs(deep ? { q, deep: 1 } : { q })}`, opts),
    aiCandidates: (q: string, opts?: RequestOptions) =>
      apiFetch<ExternalProductSuggestionDto[]>(`/products/ai-candidates${qs({ q })}`, opts),
    get: (id: string, opts?: RequestOptions) => apiFetch<ProductDetailDto>(`/products/${id}`, opts),
    insights: (id: string, opts?: RequestOptions) =>
      apiFetch<ProductInsightsDto>(`/products/${id}/insights`, opts),
    similar: (id: string, opts?: RequestOptions) =>
      apiFetch<ProductSummaryDto[]>(`/products/${id}/similar`, opts),
    comparePairs: (take = 30, opts?: RequestOptions) =>
      apiFetch<ComparePairDto[]>(`/products/compare-pairs${qs({ take })}`, opts),
    experiences: (id: string, opts?: RequestOptions) =>
      apiFetch<ExperienceDto[]>(`/products/${id}/experiences`, opts),
    questions: (id: string, opts?: RequestOptions) =>
      apiFetch<QuestionDto[]>(`/products/${id}/questions`, opts),
    questionSuggestions: (id: string, opts?: RequestOptions) =>
      apiFetch<{ questions: string[] }>(`/products/${id}/question-suggestions`, opts),
    prompts: (id: string, opts?: RequestOptions) =>
      apiFetch<ProductPromptDto[]>(`/products/${id}/prompts`, opts),
    create: (input: CreateProductInput) =>
      apiFetch<CreateProductResultDto>('/products', { method: 'POST', json: input }),
    identify: (image: string) =>
      apiFetch<IdentifiedProductDto>('/products/identify', { method: 'POST', json: { image } }),
    resolveEan: (ean: string, opts?: RequestOptions) =>
      apiFetch<EanResolutionDto>(`/products/resolve-ean${qs({ ean })}`, opts),
    fromPhoto: (input: FromPhotoInput) =>
      apiFetch<EnsuredProductDto>('/products/from-photo', { method: 'POST', json: input }),
    research: (query: string) =>
      apiFetch<EnsuredProductDto>('/products/research', { method: 'POST', json: { query } }),
    mine: (opts?: RequestOptions) => apiFetch<MyProductsDto>('/products/mine', opts),
    regretCheck: (input: RegretCheckInput) =>
      apiFetch<RegretCheckDto>('/products/regret-check', { method: 'POST', json: input }),
    vote: (id: string, input: QuickVoteInput) =>
      apiFetch<QuickVoteResultDto>(`/products/${id}/vote`, { method: 'POST', json: input }),
    newest: (take = 8, opts?: RequestOptions) =>
      apiFetch<ProductSummaryDto[]>(`/products/newest${qs({ take })}`, opts),
  },

  invites: {
    create: (productId: string) =>
      apiFetch<RatingInviteDto>(`/products/${productId}/invites`, { method: 'POST' }),
    publicInvite: (token: string, opts?: RequestOptions) =>
      apiFetch<PublicInviteDto>(`/e/${token}`, opts),
    rate: (token: string, input: { wouldBuyAgain: string; guestName?: string; comment?: string }) =>
      apiFetch<{ success: true }>(`/e/${token}/rate`, { method: 'POST', json: input }),
    claim: (token: string) => apiFetch<{ success: true }>(`/e/${token}/claim`, { method: 'POST' }),
    forProduct: (productId: string, opts?: RequestOptions) =>
      apiFetch<InvitedVotesSummaryDto>(`/products/${productId}/invited-votes`, opts),
  },

  experiences: {
    create: (productId: string, input: CreateExperienceInput) =>
      apiFetch<ExperienceDto>(`/products/${productId}/experiences`, { method: 'POST', json: input }),
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

  ownership: {
    create: (input: CreateOwnershipInput) =>
      apiFetch<OwnershipDto>('/ownerships', { method: 'POST', json: input }),
    mine: (opts?: RequestOptions) => apiFetch<OwnershipDto[]>('/me/ownerships', opts),
  },

  rankings: {
    topRebuy: (take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(`/rankings/top-rebuy${qs({ take, minExperiences })}`, opts),
    topRegret: (take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(`/rankings/top-regret${qs({ take, minExperiences })}`, opts),
    mostDiscussed: (take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(`/rankings/most-discussed${qs({ take, minExperiences })}`, opts),
    regretCards: (take = 6, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RegretCardDto[]>(`/rankings/regret-cards${qs({ take, minExperiences })}`, opts),
    byCategory: (slug: string, take = 20, opts?: RequestOptions, minExperiences = 1) =>
      apiFetch<RankingEntryDto[]>(`/rankings/category/${slug}${qs({ take, minExperiences })}`, opts),
    categoryOverview: (slug: string, opts?: RequestOptions) =>
      apiFetch<CategoryOverviewDto>(`/rankings/category/${slug}/overview`, opts),
    blindSpots: (opts?: RequestOptions) => apiFetch<BlindSpotDto[]>('/rankings/blind-spots', opts),
  },

  profile: {
    summary: (opts?: RequestOptions) => apiFetch<ProfileSummaryDto>('/me/profile', opts),
  },

  notifications: {
    grouped: (opts?: RequestOptions) =>
      apiFetch<GroupedNotificationInboxDto>('/me/notifications/grouped', opts),
    list: (take = 30, opts?: RequestOptions) =>
      apiFetch<NotificationListDto>(`/me/notifications${qs({ take })}`, opts),
    unreadCount: (opts?: RequestOptions) =>
      apiFetch<{ count: number }>('/me/notifications/unread-count', opts),
    openQuestions: (opts?: RequestOptions) =>
      apiFetch<OpenQuestionDto[]>('/me/notifications/open-questions', opts),
    myQuestions: (opts?: RequestOptions) =>
      apiFetch<OpenQuestionDto[]>('/me/notifications/my-questions', opts),
    markRead: (id: string) => apiFetch<void>(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    markProductRead: (productId: string) =>
      apiFetch<void>(`/me/notifications/product/${productId}/read`, { method: 'PATCH' }),
    markAllRead: () => apiFetch<void>('/me/notifications/read-all', { method: 'PATCH' }),
    pushKey: (opts?: RequestOptions) =>
      apiFetch<{ publicKey: string | null }>('/me/notifications/push/key', opts),
    pushSubscribe: (input: PushSubscriptionInput) =>
      apiFetch<void>('/me/notifications/push/subscribe', { method: 'POST', json: input }),
    pushUnsubscribe: (endpoint: string) =>
      apiFetch<void>('/me/notifications/push/unsubscribe', { method: 'POST', json: { endpoint } }),
    pushTest: () => apiFetch<PushTestResultDto>('/me/notifications/push/test', { method: 'POST' }),
  },

  showcase: {
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
    forProduct: (productId: string, opts?: RequestOptions) =>
      apiFetch<ShowcaseSummaryDto[]>(`/products/${productId}/showcases`, opts),
    mine: (opts?: RequestOptions) => apiFetch<ShowcaseSummaryDto[]>('/me/showcases', opts),
    get: (id: string, opts?: RequestOptions) => apiFetch<ShowcaseDetailDto>(`/showcases/${id}`, opts),
    create: (productId: string, input: CreateShowcaseInput) =>
      apiFetch<ShowcaseDetailDto>(`/products/${productId}/showcases`, {
        method: 'POST',
        json: input,
      }),
    update: (id: string, input: UpdateShowcaseInput) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${id}`, { method: 'PATCH', json: input }),
    publish: (id: string) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${id}/publish`, { method: 'POST' }),
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
    templates: (opts?: RequestOptions) => apiFetch<ProductTemplateDto[]>('/templates', opts),
    templatesForCategory: (categorySlug: string, opts?: RequestOptions) =>
      apiFetch<ProductTemplateDto[]>(`/templates/category/${categorySlug}`, opts),
  },

  ai: {
    playgroundTargets: (opts?: RequestOptions) =>
      apiFetch<AiPlaygroundTarget[]>('/ai/playground/targets', opts),
    playgroundChat: (input: AiPlaygroundChatRequest, opts?: RequestOptions) =>
      apiFetch<AiPlaygroundReply>('/ai/playground/chat', { ...opts, method: 'POST', json: input }),
    playgroundPing: (target: AiPlaygroundTargetId, opts?: RequestOptions) =>
      apiFetch<AiPlaygroundPing>(`/ai/playground/ping?target=${encodeURIComponent(target)}`, opts),
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
    curationResearch: (q: string, opts?: RequestOptions) =>
      apiFetch<ProductCurationResearchDto>(`/admin/products/curation-research${qs({ q })}`, opts),
    curationDraft: (ean: string, opts?: RequestOptions) =>
      apiFetch<ProductCurationDraftDto | null>(`/admin/products/curation-draft${qs({ ean })}`, opts),
    createCuratedProduct: (input: CreateCuratedProductInput) =>
      apiFetch<CreateProductResultDto>('/admin/products/curated', {
        method: 'POST',
        json: input,
      }),
    externalRatings: (productId: string, opts?: RequestOptions) =>
      apiFetch<ExternalRatingDto[]>(`/admin/products/${productId}/external-ratings`, opts),
    upsertExternalRating: (productId: string, input: UpsertExternalRatingInput) =>
      apiFetch<ExternalRatingDto>(`/admin/products/${productId}/external-ratings`, {
        method: 'POST',
        json: input,
      }),
    deleteExternalRating: (id: string) =>
      apiFetch<{ success: true }>(`/admin/external-ratings/${id}`, { method: 'DELETE' }),
    imagelessProducts: (opts?: RequestOptions) =>
      apiFetch<ImagelessProductDto[]>('/admin/products/imageless', opts),
    backfillImages: () =>
      apiFetch<ImageBackfillReportDto>('/admin/products/backfill-images', { method: 'POST' }),
    backfillRatings: () =>
      apiFetch<RatingBackfillReportDto>('/admin/products/backfill-ratings', { method: 'POST' }),
  },
};
