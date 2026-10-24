import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  companionActionSchema,
  confirmCheckInSchema,
  type CompanionActionInput,
  type CompanionOverviewDto,
  type ConfirmCheckInInput,
  type OwnershipCompanionDto,
  type ProductCompanionDto,
} from '@wudly/shared';
import { CompanionService } from './companion.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

@Controller('me/companion')
@UseGuards(JwtAuthGuard)
export class CompanionController {
  constructor(private readonly companion: CompanionService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser): Promise<CompanionOverviewDto> {
    return this.companion.overview(user.id);
  }

  @Get(':productId')
  forProduct(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ): Promise<ProductCompanionDto> {
    return this.companion.forProduct(user.id, productId);
  }

  @Post(':productId/confirm')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(confirmCheckInSchema)) dto: ConfirmCheckInInput,
  ): Promise<OwnershipCompanionDto> {
    return this.companion.confirm(user.id, productId, dto);
  }

  @Patch(':productId')
  act(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(companionActionSchema)) dto: CompanionActionInput,
  ): Promise<OwnershipCompanionDto> {
    return this.companion.act(user.id, productId, dto);
  }
}
