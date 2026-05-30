import { Controller, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  createQuestionSchema,
  createAnswerSchema,
  type CreateQuestionInput,
  type CreateAnswerInput,
  type QuestionDto,
  type AnswerDto,
} from '@wudly/shared';
import { QuestionsService } from './questions.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';

@Controller()
@UseGuards(RateLimitGuard)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Post('products/:id/questions')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  createQuestion(
    @Param('id') productId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createQuestionSchema)) dto: CreateQuestionInput,
  ): Promise<QuestionDto> {
    return this.questions.createQuestion(productId, user.id, dto);
  }

  @Post('questions/:id/answers')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  createAnswer(
    @Param('id') questionId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAnswerSchema)) dto: CreateAnswerInput,
  ): Promise<AnswerDto> {
    return this.questions.createAnswer(questionId, user.id, dto);
  }

  @Patch('answers/:id/helpful')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  markHelpful(@Param('id') answerId: string): Promise<AnswerDto> {
    return this.questions.markHelpful(answerId);
  }
}
