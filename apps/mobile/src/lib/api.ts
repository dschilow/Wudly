/**
 * Typed API surface for the Wudly app, mirroring apps/web/src/lib/api.ts. Every
 * method returns a shared DTO type so screens are fully typed against the backend
 * contract. Auth is via the Bearer token in SecureStore (see api-client).
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
  RegretCardDto,
  ProfileSummaryDto,
  CategoryDto,
  CategoryOverviewDto,
  PaginatedDto,
  NotificationListDto,
  OpenQuestionDto,
  RegisterInput,
  LoginInput,
  CreateProductInput,
  CreateExperienceInput,
  CreateQuestionInput,
  CreateAnswerInput,
  CreateOwnershipInput,
  CategoryAspectDto,
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
  ShowcaseSummaryDto,
  ShowcaseDetailDto,
  ProfileDetailDto,
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
  },

  categories: {
    list: (opts?: RequestOptions) => apiFetch<CategoryDto[]>('/categories', opts),
    /** Aspect vocabulary per category slug (for the like/dislike rating step). */
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
    experiences: (id: string, opts?: RequestOptions) =>
      apiFetch<ExperienceDto[]>(`/products/${id}/experiences`, opts),
    questions: (id: string, opts?: RequestOptions) =>
      apiFetch<QuestionDto[]>(`/products/${id}/questions`, opts),
    questionSuggestions: (id: string, opts?: RequestOptions) =>
      apiFetch<{ questions: string[] }>(`/products/${id}/question-suggestions`, opts),
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
  },

  showcase: {
    forProduct: (productId: string, opts?: RequestOptions) =>
      apiFetch<ShowcaseSummaryDto[]>(`/products/${productId}/showcases`, opts),
    get: (id: string, opts?: RequestOptions) =>
      apiFetch<ShowcaseDetailDto>(`/showcases/${id}`, opts),
    /** Public creator/brand profile with its published showcases. */
    profile: (slug: string, opts?: RequestOptions) =>
      apiFetch<ProfileDetailDto>(`/profiles/${slug}`, opts),
  },
};
