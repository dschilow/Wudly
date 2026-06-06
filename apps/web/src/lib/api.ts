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
  OpenQuestionDto,
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
  MyProductsDto,
  FromPhotoInput,
  RegretCheckDto,
  RegretCheckInput,
  QuickVoteInput,
  QuickVoteResultDto,
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
  },

  products: {
    list: (params: { take?: number; skip?: number } = {}, opts?: RequestOptions) =>
      apiFetch<PaginatedDto<ProductSummaryDto>>(`/products${qs(params)}`, opts),
    search: (q: string, take = 10, opts?: RequestOptions) =>
      apiFetch<ProductSummaryDto[]>(`/products/search${qs({ q, take })}`, opts),
    get: (id: string, opts?: RequestOptions) =>
      apiFetch<ProductDetailDto>(`/products/${id}`, opts),
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

  ownership: {
    create: (input: CreateOwnershipInput) =>
      apiFetch<OwnershipDto>('/ownerships', { method: 'POST', json: input }),
    mine: (opts?: RequestOptions) => apiFetch<OwnershipDto[]>('/me/ownerships', opts),
  },

  rankings: {
    topRebuy: (take = 20, opts?: RequestOptions) =>
      apiFetch<RankingEntryDto[]>(`/rankings/top-rebuy${qs({ take })}`, opts),
    topRegret: (take = 20, opts?: RequestOptions) =>
      apiFetch<RankingEntryDto[]>(`/rankings/top-regret${qs({ take })}`, opts),
    mostDiscussed: (take = 20, opts?: RequestOptions) =>
      apiFetch<RankingEntryDto[]>(`/rankings/most-discussed${qs({ take })}`, opts),
    byCategory: (slug: string, take = 20, opts?: RequestOptions) =>
      apiFetch<RankingEntryDto[]>(`/rankings/category/${slug}${qs({ take })}`, opts),
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
    markRead: (id: string) =>
      apiFetch<void>(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      apiFetch<void>('/me/notifications/read-all', { method: 'PATCH' }),
    pushKey: (opts?: RequestOptions) =>
      apiFetch<{ publicKey: string | null }>('/me/notifications/push/key', opts),
    pushSubscribe: (input: PushSubscriptionInput) =>
      apiFetch<void>('/me/notifications/push/subscribe', { method: 'POST', json: input }),
    pushUnsubscribe: (endpoint: string) =>
      apiFetch<void>('/me/notifications/push/unsubscribe', { method: 'POST', json: { endpoint } }),
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
  },
};
