import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateQuestionInput,
  type CreateAnswerInput,
  type QuestionDto,
  type AnswerDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  toQuestionDto,
  toAnswerDto,
  type QuestionWithRelations,
} from './question.mapper';

const QUESTION_INCLUDE = {
  askedBy: { select: { id: true, displayName: true } },
  answers: { include: { answeredBy: { select: { id: true, displayName: true } } } },
} as const;

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string): Promise<QuestionDto[]> {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Produkt nicht gefunden.');

    const questions = await this.prisma.productQuestion.findMany({
      where: { productId, status: { not: 'HIDDEN' } },
      include: QUESTION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return questions.map((q) => toQuestionDto(q as QuestionWithRelations));
  }

  async createQuestion(
    productId: string,
    userId: string,
    input: CreateQuestionInput,
  ): Promise<QuestionDto> {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Produkt nicht gefunden.');

    const question = await this.prisma.productQuestion.create({
      data: { productId, askedByUserId: userId, questionText: input.questionText, status: 'OPEN' },
      include: QUESTION_INCLUDE,
    });
    return toQuestionDto(question as QuestionWithRelations);
  }

  async createAnswer(
    questionId: string,
    userId: string,
    input: CreateAnswerInput,
  ): Promise<AnswerDto> {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, productId: true },
    });
    if (!question) throw new NotFoundException('Frage nicht gefunden.');

    const answer = await this.prisma.productAnswer.create({
      data: {
        questionId,
        productId: question.productId,
        answeredByUserId: userId,
        answerText: input.answerText,
        quickAnswer: input.quickAnswer ?? null,
      },
      include: { answeredBy: { select: { id: true, displayName: true } } },
    });

    // First answer flips the question to ANSWERED.
    await this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { status: 'ANSWERED' },
    });

    return toAnswerDto(answer);
  }

  /** Increment helpful count. Idempotency/per-user dedupe can be added later. */
  async markHelpful(answerId: string): Promise<AnswerDto> {
    const answer = await this.prisma.productAnswer
      .update({
        where: { id: answerId },
        data: { helpfulCount: { increment: 1 } },
        include: { answeredBy: { select: { id: true, displayName: true } } },
      })
      .catch(() => null);
    if (!answer) throw new NotFoundException('Antwort nicht gefunden.');
    return toAnswerDto(answer);
  }
}
