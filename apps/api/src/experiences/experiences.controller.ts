import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import {
  createExperienceSchema,
  type CreateExperienceInput,
  type ExperienceDto,
} from '@wudly/shared';
import { ExperiencesService } from './experiences.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

@Controller()
export class ExperiencesController {
  constructor(private readonly experiences: ExperiencesService) {}

  @Post('products/:id/experiences')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  create(
    @Param('id') productId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createExperienceSchema)) dto: CreateExperienceInput,
  ): Promise<ExperienceDto> {
    return this.experiences.create(productId, user.id, dto);
  }

  @Get('me/experiences')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthUser): Promise<ExperienceDto[]> {
    return this.experiences.listForUser(user.id);
  }
}
