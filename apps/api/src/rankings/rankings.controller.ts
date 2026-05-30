import { Controller, Get, Param, Query } from '@nestjs/common';
import { rankingQuerySchema, type RankingEntryDto } from '@wudly/shared';
import { RankingsService } from './rankings.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

type RankingQuery = { take: number; minExperiences: number };

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get('top-rebuy')
  topRebuy(
    @Query(new ZodValidationPipe(rankingQuerySchema)) q: RankingQuery,
  ): Promise<RankingEntryDto[]> {
    return this.rankings.topRebuy(q.take, q.minExperiences);
  }

  @Get('top-regret')
  topRegret(
    @Query(new ZodValidationPipe(rankingQuerySchema)) q: RankingQuery,
  ): Promise<RankingEntryDto[]> {
    return this.rankings.topRegret(q.take, q.minExperiences);
  }

  @Get('most-discussed')
  mostDiscussed(
    @Query(new ZodValidationPipe(rankingQuerySchema)) q: RankingQuery,
  ): Promise<RankingEntryDto[]> {
    return this.rankings.mostDiscussed(q.take, q.minExperiences);
  }

  @Get('category/:categorySlug')
  byCategory(
    @Param('categorySlug') categorySlug: string,
    @Query(new ZodValidationPipe(rankingQuerySchema)) q: RankingQuery,
  ): Promise<RankingEntryDto[]> {
    return this.rankings.topByCategory(categorySlug, q.take, q.minExperiences);
  }
}
