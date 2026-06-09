import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createBlockSchema,
  createProfileSchema,
  createShowcaseSchema,
  reorderBlocksSchema,
  updateBlockSchema,
  updateProfileSchema,
  updateShowcaseSchema,
  type CreateBlockInput,
  type CreateProfileInput,
  type CreateShowcaseInput,
  type ProductTemplateDto,
  type ProfessionalProfileDto,
  type ProfileDetailDto,
  type ReorderBlocksInput,
  type ShowcaseBlockDto,
  type ShowcaseDetailDto,
  type ShowcaseSummaryDto,
  type UpdateBlockInput,
  type UpdateProfileInput,
  type UpdateShowcaseInput,
} from '@wudly/shared';
import { ShowcaseService } from './showcase.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller()
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  /* ----------------------------- Profiles ----------------------------- */

  @Get('me/profile/professional')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@CurrentUser() user: AuthUser): Promise<ProfessionalProfileDto | null> {
    return this.showcase.getMyProfile(user.id);
  }

  @Get('profiles/:slug')
  getProfile(@Param('slug') slug: string): Promise<ProfileDetailDto> {
    return this.showcase.getProfileBySlug(slug);
  }

  @Post('profiles')
  @UseGuards(JwtAuthGuard)
  createProfile(
    @Body(new ZodValidationPipe(createProfileSchema)) dto: CreateProfileInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ProfessionalProfileDto> {
    return this.showcase.createProfile(user.id, dto);
  }

  @Patch('profiles/:id')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ProfessionalProfileDto> {
    return this.showcase.updateProfile(user.id, id, dto);
  }

  @Post('profiles/:id/verify-request')
  @UseGuards(JwtAuthGuard)
  requestVerification(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProfessionalProfileDto> {
    return this.showcase.requestVerification(user.id, id);
  }

  /* ----------------------------- Showcases ---------------------------- */

  @Get('me/showcases')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthUser): Promise<ShowcaseSummaryDto[]> {
    return this.showcase.listMine(user.id);
  }

  @Get('products/:productId/showcases')
  listForProduct(@Param('productId') productId: string): Promise<ShowcaseSummaryDto[]> {
    return this.showcase.listForProduct(productId);
  }

  @Get('showcases/:id')
  getShowcase(@Param('id') id: string): Promise<ShowcaseDetailDto> {
    return this.showcase.getShowcase(id);
  }

  @Post('products/:productId/showcases')
  @UseGuards(JwtAuthGuard)
  createShowcase(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createShowcaseSchema)) dto: CreateShowcaseInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ShowcaseDetailDto> {
    return this.showcase.createShowcase(user.id, productId, dto);
  }

  @Patch('showcases/:id')
  @UseGuards(JwtAuthGuard)
  updateShowcase(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateShowcaseSchema)) dto: UpdateShowcaseInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ShowcaseDetailDto> {
    return this.showcase.updateShowcase(user.id, id, dto);
  }

  @Post('showcases/:id/publish')
  @UseGuards(JwtAuthGuard)
  publishShowcase(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ShowcaseDetailDto> {
    return this.showcase.publishShowcase(user.id, id);
  }

  /* ------------------------------ Blocks ------------------------------ */

  @Post('showcases/:id/blocks')
  @UseGuards(JwtAuthGuard)
  addBlock(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createBlockSchema)) dto: CreateBlockInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ShowcaseBlockDto> {
    return this.showcase.addBlock(user.id, id, dto);
  }

  @Patch('showcase-blocks/:id')
  @UseGuards(JwtAuthGuard)
  updateBlock(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBlockSchema)) dto: UpdateBlockInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ShowcaseBlockDto> {
    return this.showcase.updateBlock(user.id, id, dto);
  }

  @Delete('showcase-blocks/:id')
  @UseGuards(JwtAuthGuard)
  deleteBlock(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: true }> {
    return this.showcase.deleteBlock(user.id, id);
  }

  @Patch('showcases/:id/reorder-blocks')
  @UseGuards(JwtAuthGuard)
  reorderBlocks(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reorderBlocksSchema)) dto: ReorderBlocksInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ShowcaseDetailDto> {
    return this.showcase.reorderBlocks(user.id, id, dto);
  }

  /* ----------------------------- Templates ---------------------------- */

  @Get('templates')
  listTemplates(): Promise<ProductTemplateDto[]> {
    return this.showcase.listTemplates();
  }

  @Get('templates/category/:categorySlug')
  listTemplatesForCategory(
    @Param('categorySlug') categorySlug: string,
  ): Promise<ProductTemplateDto[]> {
    return this.showcase.listTemplatesForCategory(categorySlug);
  }
}
