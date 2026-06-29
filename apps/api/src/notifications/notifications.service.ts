import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  NotificationType,
  type GroupedNotificationInboxDto,
  type InboxQuestionDto,
  type NotificationDto,
  type NotificationListDto,
} from '@wudly/shared';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';
import { toQuestionDto, type QuestionWithRelations } from '../questions/question.mapper';

const INBOX_QUESTION_INCLUDE = {
  askedBy: { select: { id: true, displayName: true } },
  answers: { include: { answeredBy: { select: { id: true, displayName: true } } } },
} as const;

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  productId?: string | null;
  questionId?: string | null;
}

/**
 * In-app notifications. Creation is best-effort (never blocks the action that
 * triggered it) — the Q&A flow stays fast even if notification writes fail.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PushService) private readonly push: PushService,
  ) {}

  /** Best-effort create; swallows errors so callers can fire-and-forget. */
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          productId: input.productId ?? null,
          questionId: input.questionId ?? null,
        },
      });
      // Also push to the user's devices (no-op if push isn't configured/subscribed).
      void this.push.sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        url: input.link,
      });
    } catch (err) {
      this.logger.warn(`Notification create failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Create many at once (e.g. notify all owners of a product). */
  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    if (inputs.length === 0) return;
    try {
      await this.prisma.notification.createMany({
        data: inputs.map((i) => ({
          userId: i.userId,
          type: i.type,
          title: i.title,
          body: i.body ?? null,
          link: i.link ?? null,
          productId: i.productId ?? null,
          questionId: i.questionId ?? null,
        })),
      });
      // Push to every recipient's devices (best-effort, non-blocking).
      void Promise.all(
        inputs.map((i) =>
          this.push.sendToUser(i.userId, { title: i.title, body: i.body, url: i.link }),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Notification createMany failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async list(userId: string, take = 30): Promise<NotificationListDto> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: rows.map(toNotificationDto), unreadCount };
  }

  async groupedInbox(userId: string): Promise<GroupedNotificationInboxDto> {
    const [rows, ownerships, createdProducts, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.ownership.findMany({ where: { userId }, select: { productId: true } }),
      this.prisma.product.findMany({ where: { createdByUserId: userId }, select: { id: true } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const eligibleProductIds = new Set([
      ...ownerships.map((ownership) => ownership.productId),
      ...createdProducts.map((product) => product.id),
    ]);
    const notifiedProductIds = rows
      .map((row) => row.productId)
      .filter((id): id is string => Boolean(id));
    const productIds = [...new Set([...notifiedProductIds, ...eligibleProductIds])];
    if (productIds.length === 0) {
      return { groups: [], ungrouped: rows.map(toNotificationDto), unreadCount };
    }

    const [products, questions, ownerCounts] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, status: { not: 'HIDDEN' } },
        include: { category: true, insightSnapshot: true },
      }),
      this.prisma.productQuestion.findMany({
        where: { productId: { in: productIds }, status: { not: 'HIDDEN' } },
        include: INBOX_QUESTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      this.prisma.ownership.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { _all: true },
      }),
    ]);
    const ownerCountMap = new Map(ownerCounts.map((row) => [row.productId, row._count._all]));
    const notificationsByProduct = new Map<string, NotificationDto[]>();
    const questionsByProduct = new Map<string, InboxQuestionDto[]>();

    for (const row of rows) {
      if (!row.productId) continue;
      const items = notificationsByProduct.get(row.productId) ?? [];
      items.push(toNotificationDto(row));
      notificationsByProduct.set(row.productId, items);
    }
    for (const row of questions) {
      const dto = toQuestionDto(
        row as unknown as QuestionWithRelations,
        ownerCountMap.get(row.productId) ?? 0,
      );
      const answeredByMe = row.answers.some((answer) => answer.answeredByUserId === userId);
      const item: InboxQuestionDto = {
        ...dto,
        answeredByMe,
        canAnswer:
          eligibleProductIds.has(row.productId) && row.askedByUserId !== userId && !answeredByMe,
      };
      const items = questionsByProduct.get(row.productId) ?? [];
      items.push(item);
      questionsByProduct.set(row.productId, items);
    }

    const groups = products
      .map((product) => {
        const notifications = notificationsByProduct.get(product.id) ?? [];
        const productQuestions = questionsByProduct.get(product.id) ?? [];
        const latestCandidates = [
          ...notifications.map((item) => item.createdAt),
          ...productQuestions.map((item) => item.createdAt),
        ];
        const latestAt = latestCandidates.sort((a, b) => b.localeCompare(a))[0];
        return {
          product: toProductSummaryDto(product as ProductWithRelations),
          notifications,
          questions: productQuestions,
          unreadCount: notifications.filter((item) => !item.read).length,
          latestAt: latestAt ?? new Date(0).toISOString(),
        };
      })
      .filter(
        (group) =>
          group.notifications.length > 0 ||
          group.questions.some((question) => question.canAnswer || question.askedByUserId === userId),
      )
      .sort((a, b) => {
        const unread = Number(b.unreadCount > 0) - Number(a.unreadCount > 0);
        return unread || b.latestAt.localeCompare(a.latestAt);
      });

    // A notification whose product no longer has a visible group (deleted, hidden
    // or merged away) must still surface in the inbox instead of vanishing.
    const groupedProductIds = new Set(groups.map((group) => group.product.id));
    return {
      groups,
      ungrouped: rows
        .filter((row) => !row.productId || !groupedProductIds.has(row.productId))
        .map(toNotificationDto),
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Mark a single notification read (no-op if it isn't the user's). */
  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markProductRead(userId: string, productId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, productId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type as NotificationType,
    title: n.title,
    body: n.body,
    link: n.link,
    productId: n.productId,
    questionId: n.questionId,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}
