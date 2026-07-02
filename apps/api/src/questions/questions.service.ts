import { BadRequestException, Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { EmailService } from '../email/email.service';
import { questionAnsweredEmail } from '../email/email-templates';
import type { AppConfig } from '../config/configuration';
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
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async listForProduct(productId: string): Promise<QuestionDto[]> {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Produkt nicht gefunden.');

    const [questions, ownerCount] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where: { productId, status: { not: 'HIDDEN' } },
        include: QUESTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ownership.count({ where: { productId } }),
    ]);
    return questions.map((q) => toQuestionDto(q as QuestionWithRelations, ownerCount));
  }

  /**
   * OPEN questions on products the given user owns (but did not ask themselves).
   * Powers the "answer the owner" inbox in the profile.
   */
  async listOpenForOwner(userId: string): Promise<OpenQuestionDto[]> {
    const [ownerships, created] = await Promise.all([
      this.prisma.ownership.findMany({ where: { userId }, select: { productId: true } }),
      this.prisma.product.findMany({ where: { createdByUserId: userId }, select: { id: true } }),
    ]);
    const productIds = Array.from(
      new Set([...ownerships.map((o) => o.productId), ...created.map((c) => c.id)]),
    );
    if (productIds.length === 0) return [];

    const questions = await this.prisma.productQuestion.findMany({
      where: {
        productId: { in: productIds },
        status: { not: 'HIDDEN' },
        askedByUserId: { not: userId },
        answers: { none: { answeredByUserId: userId } },
      },
      include: {
        ...QUESTION_INCLUDE,
        product: { include: { category: true, insightSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const ownerCounts = await this.ownerCountMap(productIds);
    return questions.map((q) => ({
      question: toQuestionDto(q as unknown as QuestionWithRelations, ownerCounts.get(q.productId) ?? 0),
      product: toProductSummaryDto(q.product as ProductWithRelations),
    }));
  }

  /** Questions the given user asked, newest first, with answer progress + product context. */
  async listAskedByUser(userId: string): Promise<OpenQuestionDto[]> {
    const questions = await this.prisma.productQuestion.findMany({
      where: { askedByUserId: userId, status: { not: 'HIDDEN' } },
      include: {
        ...QUESTION_INCLUDE,
        product: { include: { category: true, insightSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (questions.length === 0) return [];
    const ownerCounts = await this.ownerCountMap(questions.map((q) => q.productId));
    return questions.map((q) => ({
      question: toQuestionDto(q as unknown as QuestionWithRelations, ownerCounts.get(q.productId) ?? 0),
      product: toProductSummaryDto(q.product as ProductWithRelations),
    }));
  }

  /** owners-per-product counts for a set of products, as a lookup map. */
  private async ownerCountMap(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const grouped = await this.prisma.ownership.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.productId, g._count._all]));
  }

  async createQuestion(
    productId: string,
    userId: string,
    input: CreateQuestionInput,
  ): Promise<QuestionDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, canonicalName: true, createdByUserId: true },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const question = await this.prisma.productQuestion.create({
      data: { productId, askedByUserId: userId, questionText: input.questionText, status: 'OPEN' },
      include: QUESTION_INCLUDE,
    });

    // Persist owner inbox notifications before returning so the Q&A loop is durable.
    await this.notifyOwnersOfQuestion({
      productId,
      productName: product.canonicalName,
      questionId: question.id,
      createdByUserId: product.createdByUserId,
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
      select: { id: true, productId: true, askedByUserId: true, questionText: true },
    });
    if (!question) throw new NotFoundException('Frage nicht gefunden.');

    const alreadyAnswered = await this.prisma.productAnswer.findFirst({
      where: { questionId, answeredByUserId: userId },
      select: { id: true },
    });
    if (alreadyAnswered) throw new BadRequestException('Du hast diese Frage bereits beantwortet.');

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

    // Notify the asker that their question got an answer: in-app always, email
    // best-effort on top (the core Q&A loop must not depend on mail delivery).
    if (question.askedByUserId && question.askedByUserId !== userId) {
      const [product, asker] = await Promise.all([
        this.prisma.product.findUnique({
          where: { id: question.productId },
          select: { canonicalName: true },
        }),
        this.prisma.user.findUnique({
          where: { id: question.askedByUserId },
          select: { email: true },
        }),
      ]);
      void this.notifications.create({
        userId: question.askedByUserId,
        type: NotificationType.QUESTION_ANSWERED,
        title: 'Deine Frage wurde beantwortet',
        body: product ? `Zu „${product.canonicalName}"` : undefined,
        link: `/me/inbox?product=${question.productId}&question=${questionId}`,
        productId: question.productId,
        questionId,
      });
      if (asker?.email) {
        this.sendAnsweredEmail(asker.email, {
          productName: product?.canonicalName ?? 'deinem Produkt',
          questionText: question.questionText,
          answerText: input.answerText,
          productId: question.productId,
          questionId,
        });
      }
    }

    return toAnswerDto(answer);
  }

  /** Fire-and-forget: a failed email must never fail the answer request. */
  private sendAnsweredEmail(
    to: string,
    params: {
      productName: string;
      questionText: string;
      answerText: string;
      productId: string;
      questionId: string;
    },
  ): void {
    const webAppUrl = this.config.get('WEB_APP_URL', { infer: true });
    const message = questionAnsweredEmail({
      productName: params.productName,
      questionText: params.questionText,
      answerText: params.answerText,
      questionUrl: `${webAppUrl}/me/inbox?product=${params.productId}&question=${params.questionId}`,
    });
    void this.email.send({ to, ...message }).catch((err) => {
      this.logger.warn(`Question-answered email failed: ${err instanceof Error ? err.message : err}`);
    });
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
        link: `/me/inbox?product=${answer.productId}&question=${answer.questionId}`,
        productId: answer.productId,
        questionId: answer.questionId,
      });
    }

    return toAnswerDto(answer);
  }

  private async notifyOwnersOfQuestion(params: {
    productId: string;
    productName: string;
    questionId: string;
    createdByUserId: string | null;
  }): Promise<void> {
    // Recipients = everyone who owns the product PLUS whoever added it to Wudly.
    // If the asker is also an owner/creator, keep them in the loop: owners expect
    // product questions to land in their inbox on every device.
    const owners = await this.prisma.ownership.findMany({
      where: { productId: params.productId },
      select: { userId: true },
    });

    const recipientIds = new Set<string>(owners.map((o) => o.userId));
    if (params.createdByUserId) recipientIds.add(params.createdByUserId);
    if (recipientIds.size === 0) return;

    await this.notifications.createMany(
      [...recipientIds].map((userId) => ({
        userId,
        type: NotificationType.QUESTION_ASKED,
        title: 'Neue Frage zu deinem Produkt',
        body: `Jemand fragt zu „${params.productName}".`,
        link: `/me/inbox?product=${params.productId}&question=${params.questionId}`,
        productId: params.productId,
        questionId: params.questionId,
      })),
    );
  }
}
