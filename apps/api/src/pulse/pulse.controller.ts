import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createPulseActionSchema,
  createPulseChangeSchema,
  pulseCompetitorSchema,
  pulseWatchSchema,
  updatePulseActionSchema,
  updatePulseChangeSchema,
  type CreatePulseActionInput,
  type CreatePulseChangeInput,
  type PulseAccessDto,
  type PulseActionDto,
  type PulseChangeDto,
  type PulseCompetitorInput,
  type PulseCompetitorSetDto,
  type PulseFeedbackPageDto,
  type PulseOverviewDto,
  type PulseProduct360Dto,
  type PulseReportDto,
  type PulseReportType,
  type PulseSignalDto,
  type PulseWatchInput,
  type PulseWorkspaceDto,
  type UpdatePulseActionInput,
  type UpdatePulseChangeInput,
  type UsageDuration,
  type WouldBuyAgain,
} from '@wudly/shared';
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PulseService } from './pulse.service';
import { PulseViewsService } from './pulse-views.service';

const REPORT_TYPES = new Set<PulseReportType>([
  'health',
  'executive',
  'longterm',
  'competition',
  'actions',
]);

/** Clamp the analysis window to something meaningful (default 90 days). */
function parseDays(raw?: string): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(value)) return 90;
  return Math.min(365, Math.max(7, value));
}

/**
 * Wudly Pulse — the B2B dashboard API. Everything requires a logged-in user
 * with a BRAND/MERCHANT professional profile (enforced in the service); Pulse
 * reads the neutral signal but can only ever write to its own tables.
 */
@Controller('pulse')
@UseGuards(JwtAuthGuard)
export class PulseController {
  constructor(
    private readonly pulse: PulseService,
    private readonly views: PulseViewsService,
  ) {}

  /** Access probe for the web shell (no exception when not allowed). */
  @Get('access')
  access(@CurrentUser() user: AuthUser): Promise<PulseAccessDto> {
    return this.pulse.access(user.id);
  }

  @Get('workspace')
  async workspace(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ): Promise<PulseWorkspaceDto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.views.workspace(profile, parseDays(days));
  }

  @Get('overview')
  async overview(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ): Promise<PulseOverviewDto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.views.overview(profile, parseDays(days));
  }

  @Get('signals')
  async signals(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ): Promise<PulseSignalDto[]> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.views.signals(profile, parseDays(days));
  }

  @Get('products/:productId')
  async product360(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Query('days') days?: string,
  ): Promise<PulseProduct360Dto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.views.product360(profile, productId, parseDays(days));
  }

  @Get('competitors')
  async competitors(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ): Promise<PulseCompetitorSetDto[]> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.views.competitors(profile, parseDays(days));
  }

  /* ----------------------------- Watchlist --------------------------- */

  @Post('watch')
  async watch(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pulseWatchSchema)) dto: PulseWatchInput,
  ): Promise<{ id: string }> {
    const profile = await this.pulse.requireProfile(user.id);
    const watch = await this.pulse.watchProduct(profile.id, dto.productId);
    return { id: watch.id };
  }

  @Delete('watch/:watchId')
  async unwatch(
    @CurrentUser() user: AuthUser,
    @Param('watchId') watchId: string,
  ): Promise<{ success: true }> {
    const profile = await this.pulse.requireProfile(user.id);
    await this.pulse.unwatch(profile.id, watchId);
    return { success: true };
  }

  @Post('watch/:watchId/competitors')
  async addCompetitor(
    @CurrentUser() user: AuthUser,
    @Param('watchId') watchId: string,
    @Body(new ZodValidationPipe(pulseCompetitorSchema)) dto: PulseCompetitorInput,
  ): Promise<{ id: string }> {
    const profile = await this.pulse.requireProfile(user.id);
    const row = await this.pulse.addCompetitor(profile.id, watchId, dto.competitorProductId);
    return { id: row.id };
  }

  @Delete('competitors/:competitorId')
  async removeCompetitor(
    @CurrentUser() user: AuthUser,
    @Param('competitorId') competitorId: string,
  ): Promise<{ success: true }> {
    const profile = await this.pulse.requireProfile(user.id);
    await this.pulse.removeCompetitor(profile.id, competitorId);
    return { success: true };
  }

  /* ------------------------------ Actions ---------------------------- */

  @Get('actions')
  async listActions(@CurrentUser() user: AuthUser): Promise<PulseActionDto[]> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.pulse.listActions(profile.id);
  }

  @Post('actions')
  async createAction(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPulseActionSchema)) dto: CreatePulseActionInput,
  ): Promise<PulseActionDto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.pulse.createAction(profile.id, dto);
  }

  @Patch('actions/:id')
  async updateAction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePulseActionSchema)) dto: UpdatePulseActionInput,
  ): Promise<PulseActionDto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.pulse.updateAction(profile.id, id, dto);
  }

  @Delete('actions/:id')
  async deleteAction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const profile = await this.pulse.requireProfile(user.id);
    await this.pulse.deleteAction(profile.id, id);
    return { success: true };
  }

  /* ------------------------------ Changes ---------------------------- */

  @Get('changes')
  async listChanges(@CurrentUser() user: AuthUser): Promise<PulseChangeDto[]> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.pulse.listChanges(profile.id);
  }

  @Post('changes')
  async createChange(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPulseChangeSchema)) dto: CreatePulseChangeInput,
  ): Promise<PulseChangeDto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.pulse.createChange(profile.id, dto);
  }

  @Patch('changes/:id')
  async updateChange(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePulseChangeSchema)) dto: UpdatePulseChangeInput,
  ): Promise<PulseChangeDto> {
    const profile = await this.pulse.requireProfile(user.id);
    return this.pulse.updateChange(profile.id, id, dto);
  }

  @Delete('changes/:id')
  async deleteChange(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const profile = await this.pulse.requireProfile(user.id);
    await this.pulse.deleteChange(profile.id, id);
    return { success: true };
  }

  /* ----------------------------- Feedback ---------------------------- */

  @Get('feedback')
  async feedback(
    @CurrentUser() user: AuthUser,
    @Query('productId') productId?: string,
    @Query('wouldBuyAgain') wouldBuyAgain?: string,
    @Query('usageDuration') usageDuration?: string,
    @Query('verified') verified?: string,
    @Query('sentiment') sentiment?: string,
    @Query('days') days?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ): Promise<PulseFeedbackPageDto> {
    const profile = await this.pulse.requireProfile(user.id);
    const parsedDays = days ? parseDays(days) : undefined;
    return this.views.feedback(profile, {
      productId: productId || undefined,
      wouldBuyAgain: (wouldBuyAgain || undefined) as WouldBuyAgain | undefined,
      usageDuration: (usageDuration || undefined) as UsageDuration | undefined,
      verifiedOnly: verified === '1' || verified === 'true',
      sentiment:
        sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral'
          ? sentiment
          : undefined,
      days: parsedDays,
      q: q || undefined,
      take: Math.min(50, Math.max(1, Number.parseInt(take ?? '', 10) || 20)),
      skip: Math.max(0, Number.parseInt(skip ?? '', 10) || 0),
    });
  }

  /* ------------------------------ Reports ---------------------------- */

  @Get('reports/:type')
  async report(
    @CurrentUser() user: AuthUser,
    @Param('type') type: string,
    @Query('days') days?: string,
  ): Promise<PulseReportDto> {
    if (!REPORT_TYPES.has(type as PulseReportType)) {
      throw new BadRequestException('Unbekannter Report-Typ.');
    }
    const profile = await this.pulse.requireProfile(user.id);
    return this.views.report(profile, type as PulseReportType, parseDays(days));
  }
}
