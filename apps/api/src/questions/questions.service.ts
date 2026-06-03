import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationType,
  type CreateQuestionInput,
  type CreateAnswerInput,
  type QuestionDto,
  type AnswerDto,
  type OpenQuestionDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  /**
   * OPEN questions on products the given user owns (but did not ask themselves).
   * Powers the "answer the owner" inbox in the profile.
   */
  async listOpenForOwner(userId: string): Promise<OpenQuestionDto[]> {
    const ownerships = await this.prisma.ownership.findMany({
      where: { userId },
      select: { productId: true },
    });
    const productIds = ownerships.map((o) => o.productId);
    if (productIds.length === 0) return [];

    const questions = await this.prisma.productQuestion.findMany({
      where: {
        productId: { in: productIds },
        status: 'OPEN',
        NOT: { askedByUserId: userId },
      },
      include: {
        ...QUESTION_INCLUDE,
        product: { include: { category: true, insightSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return questions.map((q) => ({
      question: toQuestionDto(q as unknown as QuestionWithRelations),
      product: toProductSummaryDto(q.product as ProductWithRelations),
    }));
  }

  async createQuestion(
    productId: string,
    userId: string,
    input: CreateQuestionInput,
  ): Promise<QuestionDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, canonicalName: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const question = await this.prisma.productQuestion.create({
      data: { productId, askedByUserId: userId, questionText: input.questionText, status: 'OPEN' },
      include: QUESTION_INCLUDE,
    });

    // Notify every owner of this product (except the asker) that they can answer.
    void this.notifyOwnersOfQuestion(productId, userId, product.canonicalName, question.id);

    return toQuestionDto(question as QuestionWithRelations);
  }

  async createAnswer(
    questionId: string,
    userId: string,
    input: CreateAnswerInput,
  ): Promise<AnswerDto> {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, productId: true, askedByUserId: true },
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

    // Notify the asker that their question got an answer.
    if (question.askedByUserId && question.askedByUserId !== userId) {
      const product = await this.prisma.product.findUnique({
        where: { id: question.productId },
        select: { canonicalName: true },
      });
      void this.notifications.create({
        userId: question.askedByUserId,
        type: NotificationType.QUESTION_ANSWERED,
        title: 'Deine Frage wurde beantwortet',
        body: product ? `Zu „${product.canonicalName}"` : undefined,
        link: `/products/${question.productId}`,
        productId: question.productId,
        questionId,
      });
    }

    return toAnswerDto(answer);
  }

  /** Increment helpful count and notify the answer's author. */
  async markHelpful(answerId: string, byUserId: string): Promise<AnswerDto> {
    const answer = await this.prisma.productAnswer
      .update({
        where: { id: answerId },
        data: { helpfulCount: { increment: 1 } },
        include: { answeredBy: { select: { id: true, displayName: true } } },
      })
      .catch(() => null);
    if (!answer) throw new NotFoundException('Antwort nicht gefunden.');

    if (answer.answeredByUserId !== byUserId) {
      void this.notifications.create({
        userId: answer.answeredByUserId,
        type: NotificationType.ANSWER_HELPFUL,
        title: 'Deine Antwort war hilfreich',
        body: 'Jemand fand deine Antwort hilfreich.',
        link: `/products/${answer.productId}`,
        productId: answer.productId,
        questionId: answer.questionId,
      });
    }

    return toAnswerDto(answer);
  }

  private async notifyOwnersOfQuestion(
    productId: string,
    askerId: string,
    productName: string,
    questionId: string,
  ): Promise<void> {
    const owners = await this.prisma.ownership.findMany({
      where: { productId, NOT: { userId: askerId } },
      select: { userId: true },
    });
    const uniqueOwnerIds = Array.from(new Set(owners.map((o) => o.userId)));
    await this.notifications.createMany(
      uniqueOwnerIds.map((ownerId) => ({
        userId: ownerId,
        type: NotificationType.QUESTION_ASKED,
        title: 'Neue Frage zu deinem Produkt',
        body: `Jemand fragt zu „${productName}".`,
        link: `/products/${productId}`,
        productId,
        questionId,
      })),
    );
  }
}
