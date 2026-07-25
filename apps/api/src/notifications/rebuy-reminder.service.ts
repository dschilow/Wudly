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

  /** One pass: atomically claim due ownerships, notify, and release failed claims. */
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
          experienceReports: { select: { id: true }, take: 1 },
        },
        take: MAX_PER_SCAN,
      });
      if (due.length === 0) return 0;

      // Claim rows with a compare-and-set so multiple Railway replicas cannot
      // send the same reminder. A failed durable inbox write releases the claim.
      const claimedAt = new Date();
      const claimed: typeof due = [];
      for (const ownership of due) {
        const result = await this.prisma.ownership.updateMany({
          where: { id: ownership.id, reminderSentAt: null },
          data: { reminderSentAt: claimedAt },
        });
        if (result.count === 1) claimed.push(ownership);
      }
      if (claimed.length === 0) return 0;

      const created = await this.notifications.createMany(
        claimed.map((ownership) => {
          const isUpdate = ownership.experienceReports.length > 0;
          return {
            userId: ownership.userId,
            type: NotificationType.REBUY_REMINDER,
            title: isUpdate ? 'Dein Langzeit-Check' : 'Schon 6 Monate dabei',
            body: isUpdate
              ? `Hat sich dein Urteil zu „${ownership.product.canonicalName}“ verändert? Aktualisiere es – ganz ohne Rechnung.`
              : `Würdest du „${ownership.product.canonicalName}“ wieder kaufen?`,
            link: `/products/${ownership.productId}/own`,
            productId: ownership.productId,
          };
        }),
      );

      if (!created) {
        await this.prisma.ownership.updateMany({
          where: {
            id: { in: claimed.map((ownership) => ownership.id) },
            reminderSentAt: claimedAt,
          },
          data: { reminderSentAt: null },
        });
        return 0;
      }

      this.logger.log(`Sent ${claimed.length} 6-month owner check-in reminder(s).`);
      return claimed.length;
    } catch (err) {
      this.logger.warn(`Rebuy reminder scan failed: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }
}
