import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  productSightingSchema,
  sightingResolveQuerySchema,
  type ProductSightingInput,
  type SightingResolveQuery,
  type SightingResolutionDto,
  type SightingStatsDto,
} from '@wudly/shared';
import { SightingsService } from './sightings.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

/**
 * Browser-extension endpoints. Anonymous by design — no auth, no install
 * tokens, no user linkage. Abuse is contained by per-IP rate limits here plus
 * the worker's daily create/research budgets: a flood can grow the sightings
 * QUEUE, but never the catalog or the AI bill beyond the configured caps.
 */
@Controller('sightings')
export class SightingsController {
  constructor(private readonly sightings: SightingsService) {}

  /** Record a sighting and resolve it against the catalog in one round trip. */
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  record(
    @Body(new ZodValidationPipe(productSightingSchema)) dto: ProductSightingInput,
  ): Promise<SightingResolutionDto> {
    return this.sightings.resolveAndRecord(dto);
  }

  /** Pure lookup that records nothing — for users who disabled reporting. */
  @Get('resolve')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  resolve(
    @Query(new ZodValidationPipe(sightingResolveQuerySchema)) query: SightingResolveQuery,
  ): Promise<SightingResolutionDto> {
    return this.sightings.resolveOnly(query);
  }

  /** Pipeline observability: counters by status + most-demanded open sightings. */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  stats(): Promise<SightingStatsDto> {
    return this.sightings.stats();
  }
}
