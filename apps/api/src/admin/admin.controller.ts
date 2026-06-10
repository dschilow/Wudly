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
} from '@wudly/shared';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ExternalRatingsService } from '../products/external-ratings.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly externalRatings: ExternalRatingsService,
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
}
