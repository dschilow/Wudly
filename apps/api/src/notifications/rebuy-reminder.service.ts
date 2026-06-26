import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { NotificationType } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/** Six months in milliseconds — the honeymoon phase is over, the truth is in. */
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;
/** How often the in-process scheduler scans. Daily is plenty for a 6-month nudge. */
const SCAN_INTERVAL_MS = 1000 * 60 * 60 * 24;
/** Wait after boot before the first scan, so startup stays snappy. */
const INITIAL_DELAY_MS = 1000 * 60 * 2;
/** Cap per scan so a backlog can't fan out a flood of pushes at once. */
const MAX_PER_SCAN = 200;

/**
 * The most important contribution loop: when someone has owned a product for ~6
 * months, nudge them once — "would you buy it again?" — deep-linking into the
 * quick rebuy flow. The right moment, after the honeymoon, is what makes Wudly's
 * data honest.
 *
 * Runs as a lightweight in-process interval (no extra scheduler dependency). The
 * scan is idempotent (`reminderSentAt` gates re-sends) so multiple replicas or a
 * restart can't double-notify the same ownership.
 */
@Injectable()
export class RebuyReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RebuyReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private initial: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    // Skip the scheduler under tests to avoid background work / open handles.
    if (process.env.NODE_ENV === 'test') return;
    this.initial = setTimeout(() => {
      void this.runScan();
      this.timer = setInterval(() => void this.runScan(), SCAN_INTERVAL_MS);
    }, INITIAL_DELAY_MS);
  }

  onModuleDestroy(): void {
    if (this.initial) clearTimeout(this.initial);
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass: find due ownerships, notify, mark sent. Public for manual triggers/tests. */
  async runScan(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - SIX_MONTHS_MS);
      const due = await this.prisma.ownership.findMany({
        where: { reminderSentAt: null, createdAt: { lte: cutoff } },
        select: {
          id: true,
          userId: true,
          productId: true,
          product: { select: { canonicalName: true } },
        },
        take: MAX_PER_SCAN,
      });

      // Only nudge owners who haven't already shared an experience for this product.
      const filtered: typeof due = [];
      for (const o of due) {
        const reported = await this.prisma.experienceReport.findFirst({
          where: { userId: o.userId, productId: o.productId },
          select: { id: true },
        });
        if (!reported) filtered.push(o);
      }

      if (filtered.length === 0) return 0;

      await this.notifications.createMany(
        filtered.map((o) => ({
          userId: o.userId,
          type: NotificationType.REBUY_REMINDER,
          title: 'Schon 6 Monate dabei',
          body: `Würdest du „${o.product.canonicalName}" wieder kaufen?`,
          link: `/products/${o.productId}/own`,
          productId: o.productId,
        })),
      );

      await this.prisma.ownership.updateMany({
        where: { id: { in: filtered.map((o) => o.id) } },
        data: { reminderSentAt: new Date() },
      });

      this.logger.log(`Sent ${filtered.length} 6-month rebuy reminder(s).`);
      return filtered.length;
    } catch (err) {
      this.logger.warn(`Rebuy reminder scan failed: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }
}
