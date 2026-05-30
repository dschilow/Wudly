import {
  Controller,
  Get,
  Post,
  Patch,
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
  type CreateProductInput,
  type UpdateProductInput,
  type ProductSummaryDto,
  type ProductDetailDto,
  type ProductInsightsDto,
  type CreateProductResultDto,
  type PaginatedDto,
  type ExperienceDto,
  type QuestionDto,
} from '@wudly/shared';
import { ProductsService } from './products.service';
import { ProductInsightsService } from './product-insights.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
