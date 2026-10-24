import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import {
  dueCheckInLabel,
  NotificationType,
  ownershipAgeLabel,
  type CheckInJourney,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  COMPANION_OWNERSHIP_FIELDS,
  COMPANION_REPORT_FIELDS,
  journeyFor,
  plannedReminderAt,
  type CompanionOwnershipRow,
} from '../companion/companion-journey';

/** Hourly passes keep reminders close to their slot at negligible cost (indexed). */
const SCAN_INTERVAL_MS = 1000 * 60 * 60;
/** Wait after boot before the first scan, so startup stays snappy. */
const INITIAL_DELAY_MS = 1000 * 60 * 2;
/** Rows per page and pages per pass — bounds one pass even after a backlog. */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;
/** Reminders go out in the daytime (Europe/Berlin) only — never a 3 a.m. push. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 20;

type ScanRow = CompanionOwnershipRow & {
  product: { canonicalName: string; status: string };
};

interface DueReminder {
  row: ScanRow;
  journey: CheckInJourney;
}

/**
 * The companion's reminder loop ("Besitz-Begleiter"). Owners are nudged when a
 * check-in comes due: a first verdict a few days after registering a product,
 * then after 1 month, 6 months, 1 year and 2 years of real use — the moments
 * that make Wudly's data honest. One nudge per milestone; an owner with several
 * due check-ins gets one bundled notification instead of a burst.
 *
 * Runs as a lightweight in-process interval (no scheduler dependency). Every row
 * is claimed with a compare-and-set on `nextCheckInAt`, so several replicas or a
 * restart can never double-notify, and a failed inbox write releases the claim.
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

  /** One pass: plan every ownership whose slot came up, notify the due ones. */
  async runScan(now = new Date()): Promise<number> {
    try {
      if (!isSendingHour(now)) return 0;
      let sent = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const rows = await this.prisma.ownership.findMany({
          where: { nextCheckInAt: { lte: now } },
          select: {
            ...COMPANION_OWNERSHIP_FIELDS,
            product: { select: { canonicalName: true, status: true } },
          },
          orderBy: { nextCheckInAt: 'asc' },
          take: PAGE_SIZE,
        });
        if (rows.length === 0) break;
        sent += await this.processPage(rows, now);
        if (rows.length < PAGE_SIZE) break;
      }
      if (sent > 0) this.logger.log(`Sent ${sent} companion check-in reminder(s).`);
      return sent;
    } catch (err) {
      this.logger.warn(`Check-in reminder scan failed: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }

  private async processPage(rows: ScanRow[], now: Date): Promise<number> {
    const reports = await this.prisma.experienceReport.findMany({
      where: { OR: rows.map((row) => ({ userId: row.userId, productId: row.productId })) },
      select: COMPANION_REPORT_FIELDS,
    });
    const reportByKey = new Map(
      reports.map((report) => [`${report.userId}:${report.productId}`, report]),
    );

    const claimed: DueReminder[] = [];
    for (const row of rows) {
      const journey = journeyFor(
        row,
        reportByKey.get(`${row.userId}:${row.productId}`) ?? null,
        now,
      );
      const remindAt = plannedReminderAt(row, journey);
      const send =
        journey.due !== null &&
        remindAt !== null &&
        remindAt.getTime() <= now.getTime() &&
        row.product.status !== 'HIDDEN';
      const nextCheckInAt = send
        ? plannedReminderAt({ ...row, snoozedUntil: null }, journey, now)
        : remindAt && remindAt.getTime() > now.getTime()
          ? remindAt
          : null;

      const result = await this.prisma.ownership.updateMany({
        where: { id: row.id, nextCheckInAt: row.nextCheckInAt },
        data: send
          ? {
              reminderSentAt: now,
              snoozedUntil: null,
              nextCheckInAt,
              ownedSince: new Date(journey.startedAt),
            }
          : { nextCheckInAt, ownedSince: new Date(journey.startedAt) },
      });
      if (send && result.count === 1) claimed.push({ row, journey });
    }
    if (claimed.length === 0) return 0;

    const byUser = new Map<string, DueReminder[]>();
    for (const item of claimed) {
      byUser.set(item.row.userId, [...(byUser.get(item.row.userId) ?? []), item]);
    }
    const delivered = await this.notifications.createMany(
      [...byUser.values()].map((items) =>
        items.length === 1 ? singleReminder(items[0]!) : bundledReminder(items),
      ),
    );

    if (!delivered) {
      // Release the claims so the next pass retries these reminders.
      await Promise.all(
        claimed.map(({ row }) =>
          this.prisma.ownership.updateMany({
            where: { id: row.id, reminderSentAt: now },
            data: {
              reminderSentAt: row.reminderSentAt,
              snoozedUntil: row.snoozedUntil,
              nextCheckInAt: row.nextCheckInAt,
            },
          }),
        ),
      );
      return 0;
    }
    return claimed.length;
  }
}

function singleReminder({ row, journey }: DueReminder) {
  const name = row.product.canonicalName;
  const age = ownershipAgeLabel(journey.ageDays);
  const hasVerdict = journey.latest !== null;
  return {
    userId: row.userId,
    type: NotificationType.REBUY_REMINDER,
    title: hasVerdict ? `Zeit für deinen ${dueCheckInLabel(journey)}` : 'Dein erstes Urteil fehlt noch',
    body: hasVerdict
      ? `Du nutzt „${name}“ ${age}. Würdest du es heute wieder kaufen? Ist alles wie gehabt, reicht ein Tap.`
      : `Du hast „${name}“ ${age}. Würdest du es wieder kaufen? Dauert nur 20 Sekunden.`,
    link: `/products/${row.productId}/own`,
    productId: row.productId,
  };
}

function bundledReminder(items: DueReminder[]) {
  const names = items.map(({ row }) => `„${row.product.canonicalName}“`);
  const list =
    names.length === 2
      ? `${names[0]} und ${names[1]}`
      : `${names[0]}, ${names[1]} und ${names.length - 2} weitere`;
  return {
    userId: items[0]!.row.userId,
    type: NotificationType.REBUY_REMINDER,
    title: `${items.length} Check-ins sind fällig`,
    body: `${list}: Würdest du sie heute wieder kaufen? Ist alles wie gehabt, reicht je ein Tap.`,
    link: '/me/products',
    productId: null,
  };
}

function isSendingHour(now: Date): boolean {
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
  } catch {
    return true;
  }
}
