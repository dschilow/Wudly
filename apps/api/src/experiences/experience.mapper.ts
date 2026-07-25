import type {
  ExperienceReport,
  ExperienceAspect,
  User,
  Ownership,
  Product,
  ProductVariant,
} from '@prisma/client';
import type {
  ExperienceDto,
  ExperienceAspectDto,
  AspectSentiment,
  VerificationStatus,
  OwnershipVerificationMethod,
} from '@wudly/shared';

export type ExperienceWithRelations = ExperienceReport & {
  aspects: ExperienceAspect[];
  user: Pick<User, 'id' | 'displayName'> | null;
  ownership?: Pick<Ownership, 'verificationStatus' | 'verificationMethod' | 'verifiedAt'> | null;
  product?: Pick<Product, 'id' | 'canonicalName'> | null;
  variant?: Pick<ProductVariant, 'id' | 'name'> | null;
};

export function toExperienceDto(
  report: ExperienceWithRelations,
  aspectLabels: Map<string, string>,
): ExperienceDto {
  return {
    id: report.id,
    productId: report.productId,
    productName: report.product?.canonicalName ?? null,
    userId: report.userId,
    authorName: report.user?.displayName ?? null,
    wouldBuyAgain: report.wouldBuyAgain,
    usageDuration: report.usageDuration,
    experienceMood: report.experienceMood,
    verificationStatus: (report.ownership?.verificationStatus ??
      'SELF_DECLARED') as VerificationStatus,
    wishKnownText: report.wishKnownText,
    verificationMethod:
      (report.ownership?.verificationMethod as OwnershipVerificationMethod | null) ?? null,
    freeText: report.freeText,
    insteadOfText: report.insteadOfText,
    isPublic: report.isPublic,
    variantName: report.variant?.name ?? null,
    aspects: report.aspects.map(
      (a): ExperienceAspectDto => ({
        aspectKey: a.aspectKey,
        label: aspectLabels.get(a.aspectKey) ?? a.aspectKey,
        sentiment: a.sentiment as AspectSentiment,
        severity: a.severity,
      }),
    ),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}
