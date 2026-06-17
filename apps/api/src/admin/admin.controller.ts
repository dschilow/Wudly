import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  upsertExternalRatingSchema,
  type MergeCandidateDto,
  type ExternalRatingDto,
  type UpsertExternalRatingInput,
  type ImagelessProductDto,
  type ImageBackfillReportDto,
  type RatingBackfillReportDto,
} from '@wudly/shared';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ExternalRatingsService } from '../products/external-ratings.service';
import { ProductsService } from '../products/products.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly externalRatings: ExternalRatingsService,
    private readonly products: ProductsService,
  ) {}

  @Get('merge-candidates')
  listMergeCandidates(): Promise<MergeCandidateDto[]> {
    return this.admin.listMergeCandidates('PENDING');
  }

  @Post('merge-candidates/:id/merge')
  @HttpCode(HttpStatus.OK)
  merge(@Param('id') id: string): Promise<{ canonicalProductId: string }> {
    return this.admin.merge(id);
  }

  @Post('merge-candidates/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string): Promise<{ success: true }> {
    return this.admin.reject(id);
  }

  /* --- External rating facts ("Bewertungen anderswo") --- */

  @Get('products/:id/external-ratings')
  listExternalRatings(@Param('id') productId: string): Promise<ExternalRatingDto[]> {
    return this.externalRatings.listForProduct(productId);
  }

  /** Upsert (keyed per product+source), so re-imports simply refresh values. */
  @Post('products/:id/external-ratings')
  @HttpCode(HttpStatus.OK)
  upsertExternalRating(
    @Param('id') productId: string,
    @Body(new ZodValidationPipe(upsertExternalRatingSchema)) dto: UpsertExternalRatingInput,
  ): Promise<ExternalRatingDto> {
    return this.externalRatings.upsert(productId, dto);
  }

  @Delete('external-ratings/:id')
  async deleteExternalRating(@Param('id') id: string): Promise<{ success: true }> {
    await this.externalRatings.remove(id);
    return { success: true };
  }

  /* --- Product images: "fehlt warum" overview + on-demand backfill --- */

  /** Products with no cached photo yet, oldest first (the "fehlt warum" list). */
  @Get('products/imageless')
  listImageless(): Promise<ImagelessProductDto[]> {
    return this.products.listImagelessProducts(50);
  }

  /**
   * Re-hunt photos for the oldest imageless products. One small batch per call
   * (the Google CSE quota is shared/daily); run repeatedly until `remaining` is 0.
   */
  @Post('products/backfill-images')
  @HttpCode(HttpStatus.OK)
  backfillImages(): Promise<ImageBackfillReportDto> {
    return this.products.backfillMissingImages(10);
  }

  /**
   * Research external rating facts for products that have none yet. One small
   * batch per call (the AI web search is rate-limited); run until `remaining` is 0.
   */
  @Post('products/backfill-ratings')
  @HttpCode(HttpStatus.OK)
  backfillRatings(): Promise<RatingBackfillReportDto> {
    return this.products.backfillMissingRatings(8);
  }
}
