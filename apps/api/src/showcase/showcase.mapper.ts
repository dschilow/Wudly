import type {
  Category,
  Product,
  ProductInsightSnapshot,
  ProductShowcase,
  ProductTemplate,
  ProfessionalProfile,
  ShowcaseBlock,
} from '@prisma/client';
import {
  DISCLOSURE_META,
  type DisclosureType,
  type ProductTemplateDto,
  type ProfessionalProfileDto,
  type ProfileDetailDto,
  type ShowcaseBlockDto,
  type ShowcaseBlockType,
  type ShowcaseDetailDto,
  type ShowcaseSummaryDto,
} from '@wudly/shared';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';

export type ProductForShowcase = Product & {
  category: Category | null;
  insightSnapshot: ProductInsightSnapshot | null;
};

export type ShowcaseWithRelations = ProductShowcase & {
  profile: ProfessionalProfile;
  product?: ProductForShowcase | null;
  blocks?: ShowcaseBlock[];
  _count?: { blocks: number };
};

export type ProfileWithRelations = ProfessionalProfile & {
  showcases?: ShowcaseWithRelations[];
  _count?: { showcases: number };
};

/** Disclosure types that must be visibly flagged as commercial. */
export function isCommercialDisclosure(type: DisclosureType): boolean {
  return DISCLOSURE_META[type]?.commercial ?? false;
}

export function toProfileDto(profile: ProfessionalProfile): ProfessionalProfileDto {
  return {
    id: profile.id,
    type: profile.type,
    displayName: profile.displayName,
    slug: profile.slug,
    logoUrl: profile.logoUrl,
    bio: profile.bio,
    websiteUrl: profile.websiteUrl,
    socialLinks: asStringRecord(profile.socialLinks),
    verificationStatus: profile.verificationStatus,
    paidPartnerships: profile.paidPartnerships,
    createdAt: profile.createdAt.toISOString(),
  };
}

export function toProfileDetailDto(profile: ProfileWithRelations): ProfileDetailDto {
  const showcases = (profile.showcases ?? []).map(toShowcaseSummaryDto);
  return {
    ...toProfileDto(profile),
    showcaseCount: profile._count?.showcases ?? showcases.length,
    showcases,
  };
}

export function toShowcaseBlockDto(block: ShowcaseBlock): ShowcaseBlockDto {
  return {
    id: block.id,
    type: block.type,
    sortOrder: block.sortOrder,
    content: asObject(block.content),
  };
}

export function toShowcaseSummaryDto(showcase: ShowcaseWithRelations): ShowcaseSummaryDto {
  return {
    id: showcase.id,
    productId: showcase.productId,
    title: showcase.title,
    subtitle: showcase.subtitle,
    status: showcase.status,
    disclosureType: showcase.disclosureType,
    isCommercial: isCommercialDisclosure(showcase.disclosureType),
    affiliateDisclosure: showcase.affiliateDisclosure,
    blockCount: showcase._count?.blocks ?? showcase.blocks?.length ?? 0,
    profile: toProfileDto(showcase.profile),
    product: showcase.product ? toProductSummaryDto(showcase.product as ProductWithRelations) : null,
    publishedAt: showcase.publishedAt?.toISOString() ?? null,
    createdAt: showcase.createdAt.toISOString(),
  };
}

export function toShowcaseDetailDto(showcase: ShowcaseWithRelations): ShowcaseDetailDto {
  const blocks = (showcase.blocks ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toShowcaseBlockDto);
  return {
    ...toShowcaseSummaryDto(showcase),
    blocks,
  };
}

export function toTemplateDto(
  template: ProductTemplate & { category?: Category | null },
): ProductTemplateDto {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    category: template.category
      ? { id: template.category.id, slug: template.category.slug, name: template.category.name }
      : null,
    blocks: asTemplateBlocks(template.blocks),
  };
}

/* -------- JSON column coercion helpers -------- */

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

function asTemplateBlocks(
  value: unknown,
): Array<{ type: ShowcaseBlockType; content: Record<string, unknown> }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is { type: string; content?: unknown } => typeof b === 'object' && b !== null)
    .map((b) => ({ type: b.type as ShowcaseBlockType, content: asObject(b.content) }));
}
