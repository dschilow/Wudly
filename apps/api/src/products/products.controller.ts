import {
  Controller,
  Get,
  Post,
  Patch,
  Header,
  Param,
  Query,
  Body,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import {
  productSearchQuerySchema,
  paginationQuerySchema,
  createProductSchema,
  updateProductSchema,
  identifyProductSchema,
  eanLookupQuerySchema,
  regretCheckSchema,
  quickVoteSchema,
  researchProductSchema,
  fromPhotoSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type IdentifyProductInput,
  type RegretCheckInput,
  type QuickVoteInput,
  type ResearchProductInput,
  type FromPhotoInput,
  type ProductSummaryDto,
  type ProductDetailDto,
  type ProductInsightsDto,
  type CreateProductResultDto,
  type IdentifiedProductDto,
  type EanResolutionDto,
  type EnsuredProductDto,
  type ExternalProductSuggestionDto,
  type ProductFindResultDto,
  type MyProductsDto,
  type RegretCheckDto,
  type QuickVoteResultDto,
  type PaginatedDto,
  type ExperienceDto,
  type QuestionDto,
} from '@wudly/shared';
import { ProductsService } from './products.service';
import { ProductInsightsService } from './product-insights.service';
import { ProductImageService } from './product-image.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { ExperiencesService } from '../experiences/experiences.service';
import { QuestionsService } from '../questions/questions.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly insights: ProductInsightsService,
    private readonly experiences: ExperiencesService,
    private readonly questions: QuestionsService,
    private readonly images: ProductImageService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: { take: number; skip: number },
  ): Promise<PaginatedDto<ProductSummaryDto>> {
    return this.products.list(query.take, query.skip);
  }

  @Get('search')
  search(
    @Query(new ZodValidationPipe(productSearchQuerySchema)) query: { q: string; take: number },
  ): Promise<ProductSummaryDto[]> {
    return this.products.search(query.q, query.take);
  }

  /** Real-market name search (no AI) for queries the catalog doesn't know yet. */
  @Get('external-suggestions')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  externalSuggestions(
    @Query(new ZodValidationPipe(productSearchQuerySchema)) query: { q: string; take: number },
  ): Promise<ExternalProductSuggestionDto[]> {
    return this.products.externalSuggestions(query.q);
  }

  /** Unified search: catalog (display cutoff) + market suggestions (deep=1). */
  @Get('find')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 40, windowMs: 60_000 })
  find(
    @Query(new ZodValidationPipe(productSearchQuerySchema)) query: { q: string; take: number },
    @Query('deep') deep?: string,
  ): Promise<ProductFindResultDto> {
    return this.products.findProducts(query.q, deep === '1');
  }

  /** AI-identified product candidates — the last step of the search cascade. */
  @Get('ai-candidates')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 8, windowMs: 60_000 })
  aiCandidates(
    @Query(new ZodValidationPipe(productSearchQuerySchema)) query: { q: string; take: number },
  ): Promise<ExternalProductSuggestionDto[]> {
    return this.products.aiCandidates(query.q);
  }

  @Get('resolve-ean')
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  resolveEan(
    @Query(new ZodValidationPipe(eanLookupQuerySchema)) query: { ean: string },
    @CurrentUser() user?: AuthUser,
  ): Promise<EanResolutionDto> {
    return this.products.resolveEan(query.ean, user?.id ?? null);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthUser): Promise<MyProductsDto> {
    return this.products.listMine(user.id);
  }

  /** "Frisch im Katalog" — newest products, those with a Netz-Konsens first. */
  @Get('newest')
  listNewest(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: { take: number },
  ): Promise<ProductSummaryDto[]> {
    return this.products.listNewest(query.take);
  }

  @Get('image/:normalizedName')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  getPreviewImage(@Param('normalizedName') normalizedName: string): Promise<string> {
    return this.products.getPreviewSvgByNormalizedName(normalizedName);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<ProductDetailDto> {
    return this.products.getDetail(id);
  }

  @Get(':id/similar')
  getSimilar(@Param('id') id: string): Promise<ProductSummaryDto[]> {
    return this.products.listSimilar(id);
  }

  @Get(':id/insights')
  getInsights(@Param('id') id: string): Promise<ProductInsightsDto> {
    return this.insights.getInsights(id);
  }

  @Get(':id/experiences')
  getExperiences(@Param('id') id: string): Promise<ExperienceDto[]> {
    return this.experiences.listForProduct(id);
  }

  @Get(':id/questions')
  getQuestions(@Param('id') id: string): Promise<QuestionDto[]> {
    return this.questions.listForProduct(id);
  }

  @Get(':id/question-suggestions')
  getQuestionSuggestions(@Param('id') id: string): Promise<{ questions: string[] }> {
    return this.products.suggestQuestions(id).then((questions) => ({ questions }));
  }

  @Get(':id/image')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  getPreviewImageById(@Param('id') id: string): Promise<string> {
    return this.products.getPreviewSvgById(id);
  }

  /** Cached real product photo (downloaded once from Icecat / EAN databases). */
  @Get(':id/photo')
  @Header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  async getPhoto(@Param('id') id: string): Promise<StreamableFile> {
    const image = await this.images.getOrThrow(id);
    return new StreamableFile(image.bytes, { type: image.mime });
  }

  @Get(':id/share.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getShareImageById(@Param('id') id: string): Promise<string> {
    return this.products.getShareSvgById(id);
  }

  /**
   * Re-run the photo hunt for a product and return a full diagnostic report
   * (which stage found what, why candidates failed, whether Google CSE is even
   * configured). Auth-gated and rate-limited; primarily a debugging + healing
   * tool for products that ended up without a photo.
   */
  @Post(':id/rehunt-image')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  rehuntImage(@Param('id') id: string): Promise<unknown> {
    return this.products.rehuntImage(id);
  }

  @Post('identify')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 12, windowMs: 60_000 })
  identify(
    @Body(new ZodValidationPipe(identifyProductSchema)) dto: IdentifyProductInput,
  ): Promise<IdentifiedProductDto> {
    return this.products.identify(dto.image);
  }

  @Post('regret-check')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  regretCheck(
    @Body(new ZodValidationPipe(regretCheckSchema)) dto: RegretCheckInput,
  ): Promise<RegretCheckDto> {
    return this.products.regretCheck(dto);
  }

  @Post('from-photo')
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  fromPhoto(
    @Body(new ZodValidationPipe(fromPhotoSchema)) dto: FromPhotoInput,
    @CurrentUser() user?: AuthUser,
  ): Promise<EnsuredProductDto> {
    return this.products.createFromIdentification(dto, user?.id ?? null);
  }

  @Post('research')
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  research(
    @Body(new ZodValidationPipe(researchProductSchema)) dto: ResearchProductInput,
    @CurrentUser() user?: AuthUser,
  ): Promise<EnsuredProductDto> {
    return this.products.researchAndCreate(dto.query, user?.id ?? null);
  }

  @Post(':id/vote')
  @UseGuards(OptionalAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  vote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(quickVoteSchema)) dto: QuickVoteInput,
    @CurrentUser() user?: AuthUser,
  ): Promise<QuickVoteResultDto> {
    return this.products.vote(id, user?.id ?? null, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput,
    @CurrentUser() user: AuthUser,
  ): Promise<CreateProductResultDto> {
    return this.products.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductInput,
  ): Promise<ProductDetailDto> {
    return this.products.update(id, dto);
  }
}
