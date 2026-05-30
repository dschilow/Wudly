import type { ExperienceReport, ExperienceAspect, User } from '@prisma/client';
import type { ExperienceDto, ExperienceAspectDto, AspectSentiment } from '@wudly/shared';

export type ExperienceWithRelations = ExperienceReport & {
  aspects: ExperienceAspect[];
  user: Pick<User, 'id' | 'displayName'> | null;
};

export function toExperienceDto(
  report: ExperienceWithRelations,
  aspectLabels: Map<string, string>,
): ExperienceDto {
  return {
    id: report.id,
    productId: report.productId,
    userId: report.userId,
    authorName: report.user?.displayName ?? null,
    wouldBuyAgain: report.wouldBuyAgain,
    usageDuration: report.usageDuration,
    experienceMood: report.experienceMood,
    wishKnownText: report.wishKnownText,
    freeText: report.freeText,
    isPublic: report.isPublic,
    aspects: report.aspects.map(
      (a): ExperienceAspectDto => ({
        aspectKey: a.aspectKey,
        label: aspectLabels.get(a.aspectKey) ?? a.aspectKey,
        sentiment: a.sentiment as AspectSentiment,
        severity: a.severity,
      }),
    ),
    createdAt: report.createdAt.toISOString(),
  };
}
