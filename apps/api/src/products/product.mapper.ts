import type { Category, Product, ProductInsightSnapshot } from '@prisma/client';
import {
  type ProductSummaryDto,
  type ProductDetailDto,
  type ProductInsightsDto,
  type ExternalRatingDto,
  type CategoryDto,
  type ProductSpecDto,
  type AspectStatDto,
  type UsageDuration,
  UsageDuration as UsageDurationEnum,
} from '@wudly/shared';

export type ProductWithRelations = Product & {
  category: Category | null;
  insightSnapshot: ProductInsightSnapshot | null;
};

export function toCategoryDto(category: Category | null): CategoryDto | null {
  if (!category) return null;
  return { id: category.id, slug: category.slug, name: category.name };
}

const EMPTY_DURATION_STATS: Record<UsageDuration, number> = {
  [UsageDurationEnum.LESS_THAN_WEEK]: 0,
  [UsageDurationEnum.ONE_TO_FOUR_WEEKS]: 0,
  [UsageDurationEnum.ONE_TO_SIX_MONTHS]: 0,
  [UsageDurationEnum.SIX_TO_TWELVE_MONTHS]: 0,
  [UsageDurationEnum.MORE_THAN_YEAR]: 0,
};

export function toProductSummaryDto(product: ProductWithRelations): ProductSummaryDto {
  const snap = product.insightSnapshot;
  return {
    id: product.id,
    canonicalName: product.canonicalName,
    brand: product.brand,
    category: toCategoryDto(product.category),
    imageUrl: product.imageUrl,
    status: product.status,
    rebuyScore: snap?.rebuyScore ?? null,
    regretScore: snap?.regretScore ?? null,
    ownerCount: snap?.ownerCount ?? 0,
    experienceCount: snap?.experienceCount ?? 0,
    wudlySeal: snap?.wudlySeal ?? false,
    externalAvgPercent: snap?.externalAvgPercent ?? null,
    externalSourceCount: snap?.externalSourceCount ?? 0,
  };
}

export function toProductInsightsDto(
  productId: string,
  snap: ProductInsightSnapshot | null,
  extras: Partial<Pick<ProductInsightsDto, 'verification' | 'quickVotes'>> = {},
): ProductInsightsDto {
  const verification = extras.verification ?? {
    total: 0,
    verified: 0,
    selfDeclared: 0,
    unverified: 0,
    verifiedShare: 0,
  };
  const quickVotes = extras.quickVotes ?? { rebuy: null, count: 0, yes: 0, no: 0 };

  if (!snap) {
    return {
      productId,
      ownerCount: 0,
      experienceCount: 0,
      rebuyScore: null,
      regretScore: null,
      unsureScore: null,
      topPositiveAspects: [],
      topNegativeAspects: [],
      wishKnownHighlights: [],
      usageDurationStats: { ...EMPTY_DURATION_STATS },
      suitedFor: [],
      notSuitedFor: [],
      insteadOfShare: 0,
      insteadOfHighlights: [],
      verification,
      quickVotes,
      aiHeadline: null,
      wudlySeal: false,
      generatedAt: new Date().toISOString(),
    };
  }

  // Prefer AI-generated audience hints when present; the service may still
  // overlay rule-based ones for products without an AI summary.
  const aiSuited = asStringArray(snap.aiSuitedFor);
  const aiNotSuited = asStringArray(snap.aiNotSuitedFor);

  return {
    productId,
    ownerCount: snap.ownerCount,
    experienceCount: snap.experienceCount,
    rebuyScore: snap.rebuyScore,
    regretScore: snap.regretScore,
    unsureScore: snap.unsureScore,
    topPositiveAspects: asAspectStats(snap.topPositiveAspects),
    topNegativeAspects: asAspectStats(snap.topNegativeAspects),
    wishKnownHighlights: asStringArray(snap.wishKnownHighlights),
    usageDurationStats: asDurationStats(snap.usageDurationStats),
    suitedFor: aiSuited,
    notSuitedFor: aiNotSuited,
    insteadOfShare: snap.insteadOfShare ?? 0,
    insteadOfHighlights: asStringArray(snap.insteadOfHighlights),
    verification,
    quickVotes,
    aiHeadline: snap.aiHeadline ?? null,
    wudlySeal: snap.wudlySeal ?? false,
    generatedAt: snap.generatedAt.toISOString(),
  };
}

export function toProductDetailDto(
  product: ProductWithRelations,
  insights: ProductInsightsDto,
  externalRatings: ExternalRatingDto[],
): ProductDetailDto {
  return {
    ...toProductSummaryDto(product),
    description: product.description,
    specs: asSpecDtos(product.specs),
    insights,
    externalRatings,
  };
}

/** Coerce the JSON `specs` column into typed label/value pairs. */
function asSpecDtos(value: unknown): ProductSpecDto[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is ProductSpecDto =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>).label === 'string' &&
      typeof (v as Record<string, unknown>).value === 'string',
  );
}

/* -------- JSON column coercion helpers (snapshots store JSON) -------- */

function asAspectStats(value: unknown): AspectStatDto[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAspectStat);
}

function isAspectStat(v: unknown): v is AspectStatDto {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.key === 'string' && typeof o.label === 'string' && typeof o.count === 'number';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asDurationStats(value: unknown): Record<UsageDuration, number> {
  const base = { ...EMPTY_DURATION_STATS };
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(base) as UsageDuration[]) {
      const raw = (value as Record<string, unknown>)[key];
      if (typeof raw === 'number') base[key] = raw;
    }
  }
  return base;
}
