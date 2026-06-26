import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { ProfileSummaryDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Aggregated profile summary for the current user. */
  async getProfileSummary(userId: string): Promise<ProfileSummaryDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden.');

    const [productCount, experienceCount, answerCount, helpfulAgg] = await Promise.all([
      this.prisma.ownership.count({ where: { userId } }),
      this.prisma.experienceReport.count({ where: { userId } }),
      this.prisma.productAnswer.count({ where: { answeredByUserId: userId } }),
      this.prisma.productAnswer.aggregate({
        where: { answeredByUserId: userId },
        _sum: { helpfulCount: true },
      }),
    ]);

    return {
      user: toUserDto(user),
      productCount,
      experienceCount,
      answerCount,
      helpfulReceived: helpfulAgg._sum.helpfulCount ?? 0,
    };
  }
}
