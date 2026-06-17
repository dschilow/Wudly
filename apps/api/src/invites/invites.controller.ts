import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  inviteRatingSchema,
  type InviteRatingInput,
  type RatingInviteDto,
  type PublicInviteDto,
  type InvitedVoteDto,
  type InvitedVotesSummaryDto,
} from '@wudly/shared';
import { InvitesService } from './invites.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

@Controller()
@UseGuards(RateLimitGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /** Owner creates a shareable invite link for a product. */
  @Post('products/:id/invites')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  create(@Param('id') productId: string, @CurrentUser() user: AuthUser): Promise<RatingInviteDto> {
    return this.invites.createInvite(productId, user.id);
  }

  /** Invited voices shown on the product page (clearly marked, weighted down). */
  @Get('products/:id/invited-votes')
  forProduct(@Param('id') productId: string): Promise<InvitedVotesSummaryDto> {
    return this.invites.listForProduct(productId);
  }

  /** Public: what the no-login rating page needs. */
  @Get('e/:token')
  publicInvite(@Param('token') token: string): Promise<PublicInviteDto> {
    return this.invites.getPublicInvite(token);
  }

  /** Public: submit a guest rating via the invite link. */
  @Post('e/:token/rate')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  rate(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(inviteRatingSchema)) dto: InviteRatingInput,
  ): Promise<InvitedVoteDto> {
    return this.invites.submitRating(token, dto);
  }

  /** Upgrade this invite's guest votes to full votes once the visitor signs in. */
  @Post('e/:token/claim')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  claim(
    @Param('token') token: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ claimed: number }> {
    return this.invites.claim(token, user.id);
  }
}
