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
  type CreateProductInput,
  type UpdateProductInput,
  type IdentifyProductInput,
  type RegretCheckInput,
  type QuickVoteInput,
  type ProductSummaryDto,
  type ProductDetailDto,
  type ProductInsightsDto,
  type CreateProductResultDto,
  type IdentifiedProductDto,
  type EanResolutionDto,
  type RegretCheckDto,
  type QuickVoteResultDto,
  type PaginatedDto,
  type ExperienceDto,
  type QuestionDto,
} from '@wudly/shared';
import { ProductsService } from './products.service';
import { ProductInsightsService } from './product-insights.service';
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

  @Get('resolve-ean')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  resolveEan(
    @Query(new ZodValidationPipe(eanLookupQuerySchema)) query: { ean: string },
  ): Promise<EanResolutionDto> {
    return this.products.resolveEan(query.ean);
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

  @Get(':id/share.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getShareImageById(@Param('id') id: string): Promise<string> {
    return this.products.getShareSvgById(id);
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
  ): Promise<CreateProductResultDto> {
    return this.products.create(dto);
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
