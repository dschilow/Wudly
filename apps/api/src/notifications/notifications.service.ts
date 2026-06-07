import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, type NotificationDto, type NotificationListDto } from '@wudly/shared';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

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
    private readonly prisma: PrismaService,
    private readonly push: PushService,
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
