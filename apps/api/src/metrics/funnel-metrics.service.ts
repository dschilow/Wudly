import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  FunnelEvent,
  type FunnelEvent as FunnelEventType,
  type FunnelOverviewDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';

const FLUSH_INTERVAL_MS = 10_000;
const EVENTS = Object.values(FunnelEvent);

@Injectable()
export class FunnelMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunnelMetricsService.name);
  private readonly pending = new Map<FunnelEventType, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  /**
   * Records only an aggregate event name. No user, session, IP, query, or
   * product identifier enters this service.
   */
  increment(event: FunnelEventType): void {
    this.pending.set(event, (this.pending.get(event) ?? 0) + 1);
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      await this.flushing;
      return;
    }
    if (this.pending.size === 0) return;

    const batch = new Map(this.pending);
    this.pending.clear();
    this.flushing = this.flushBatch(batch).finally(() => {
      this.flushing = null;
    });
    await this.flushing;
  }

  async overview(windowDays = 14): Promise<FunnelOverviewDto> {
    await this.flush();
    const requestedDays = Number.isFinite(windowDays) ? Math.trunc(windowDays) : 14;
    const days = Math.min(Math.max(requestedDays, 1), 90);
    const from = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));
    const rows = await this.prisma.funnelMetricDaily.findMany({
      where: { day: { gte: from } },
      orderBy: [{ day: 'asc' }, { event: 'asc' }],
    });

    const totals = Object.fromEntries(EVENTS.map((event) => [event, 0])) as Record<
      FunnelEventType,
      number
    >;
    for (const row of rows) totals[row.event] += row.count;

    return {
      windowDays: days,
      totals,
      daily: rows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        event: row.event,
        count: row.count,
      })),
      ratios: {
        researchSuccess: ratio(totals.RESEARCH_SUCCEEDED, totals.RESEARCH_STARTED),
        researchToOwnership: ratio(totals.OWNERSHIP_CREATED, totals.RESEARCH_SUCCEEDED),
        questionToAnswer: ratio(totals.ANSWER_CREATED, totals.QUESTION_CREATED),
      },
    };
  }

  private async flushBatch(batch: Map<FunnelEventType, number>): Promise<void> {
    const day = utcDay(new Date());
    try {
      await this.prisma.$transaction(
        [...batch.entries()].map(([event, count]) =>
          this.prisma.funnelMetricDaily.upsert({
            where: { day_event: { day, event } },
            create: { day, event, count },
            update: { count: { increment: count } },
          }),
        ),
      );
    } catch (error) {
      for (const [event, count] of batch) {
        this.pending.set(event, (this.pending.get(event) ?? 0) + count);
      }
      this.logger.warn(
        `Could not flush aggregate funnel metrics: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1_000) / 10;
}
