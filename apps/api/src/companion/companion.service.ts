import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CHECK_IN_SNOOZE_DAYS,
  compareUsageDuration,
  UsageDuration,
  type CompanionActionInput,
  type CompanionOverviewDto,
  type ConfirmCheckInInput,
  type OwnershipCompanionDto,
  type ProductCompanionDto,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ExperiencesService } from '../experiences/experiences.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';
import {
  COMPANION_OWNERSHIP_FIELDS,
  COMPANION_REPORT_FIELDS,
  journeyFor,
  plannedReminderAt,
  refreshCompanionSchedule,
  type CompanionOwnershipRow,
  type CompanionReportRow,
} from './companion-journey';

const DAY_MS = 86_400_000;

const COMPANION_SELECT = {
  ...COMPANION_OWNERSHIP_FIELDS,
  product: { include: { category: true, insightSnapshot: true } },
  variant: { select: { name: true } },
} as const;

type CompanionRow = CompanionOwnershipRow & {
  product: unknown;
  variant: { name: string | null } | null;
};

/**
 * The owner side of the companion ("Besitz-Begleiter"): every owned product with
 * its check-in journey, the one-tap "alles wie gehabt" check-in, and the owner's
 * reminder controls (later, pause, stopped using it).
 */
@Injectable()
export class CompanionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExperiencesService) private readonly experiences: ExperiencesService,
  ) {}

  async overview(userId: string): Promise<CompanionOverviewDto> {
    const now = new Date();
    const [ownerships, reports, created] = await Promise.all([
      this.prisma.ownership.findMany({
        where: { userId, product: { status: { not: 'HIDDEN' } } },
        select: COMPANION_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.experienceReport.findMany({ where: { userId }, select: COMPANION_REPORT_FIELDS }),
      this.prisma.product.findMany({
        where: { createdByUserId: userId, status: { not: 'HIDDEN' } },
        include: { category: true, insightSnapshot: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const reportByProduct = new Map(reports.map((report) => [report.productId, report]));
    const items = ownerships
      .map((row) => this.toDto(row, reportByProduct.get(row.productId) ?? null, now))
      .sort(companionOrder);

    const checkIns = items.flatMap((item) => item.journey.checkIns);
    const verdicts = { yes: 0, unsure: 0, no: 0, none: 0 };
    for (const item of items) {
      const latest = item.journey.latest?.wouldBuyAgain;
      if (latest === 'YES') verdicts.yes += 1;
      else if (latest === 'UNSURE') verdicts.unsure += 1;
      else if (latest === 'NO') verdicts.no += 1;
      else verdicts.none += 1;
    }
    const ownedIds = new Set(ownerships.map((row) => row.productId));

    return {
      items,
      dueCount: items.filter((item) => item.journey.due !== null).length,
      stats: {
        products: items.length,
        checkIns: checkIns.length,
        longTermCheckIns: checkIns.filter(
          (checkIn) =>
            compareUsageDuration(checkIn.usageDuration, UsageDuration.SIX_TO_TWELVE_MONTHS) >= 0,
        ).length,
        verdicts,
      },
      created: created
        .filter((product) => !ownedIds.has(product.id))
        .map((product) => toProductSummaryDto(product as ProductWithRelations)),
    };
  }

  async forProduct(userId: string, productId: string): Promise<ProductCompanionDto> {
    const [ownership, report, experience] = await Promise.all([
      this.prisma.ownership.findUnique({
        where: { userId_productId: { userId, productId } },
        select: COMPANION_SELECT,
      }),
      this.prisma.experienceReport.findUnique({
        where: { userId_productId: { userId, productId } },
        select: COMPANION_REPORT_FIELDS,
      }),
      this.experiences.findMine(userId, productId),
    ]);
    return {
      companion: ownership ? this.toDto(ownership, report, new Date()) : null,
      experience,
    };
  }

  /**
   * "Alles wie gehabt": re-confirms the stored verdict after more time of use —
   * a real checkpoint with the longer usage, keeping texts and aspects.
   */
  async confirm(
    userId: string,
    productId: string,
    input: ConfirmCheckInInput,
  ): Promise<OwnershipCompanionDto> {
    const current = await this.forProduct(userId, productId);
    const report = await this.prisma.experienceReport.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { wouldBuyAgain: true, experienceMood: true, isPublic: true },
    });
    if (!current.companion || !report) {
      throw new BadRequestException('Es gibt noch kein Urteil, das du bestätigen kannst.');
    }

    // Never step back behind what the owner already reported.
    const suggested = current.companion.journey.suggestedUsageDuration;
    const usageDuration =
      input.usageDuration && compareUsageDuration(input.usageDuration, suggested) >= 0
        ? input.usageDuration
        : suggested;

    await this.experiences.create(productId, userId, {
      wouldBuyAgain: report.wouldBuyAgain,
      experienceMood: report.experienceMood,
      isPublic: report.isPublic,
      usageDuration,
    });
    return this.requireCompanion(userId, productId);
  }

  async act(
    userId: string,
    productId: string,
    input: CompanionActionInput,
  ): Promise<OwnershipCompanionDto> {
    const ownership = await this.prisma.ownership.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });
    if (!ownership) throw new NotFoundException('Dieses Produkt ist nicht als dein Besitz markiert.');

    const now = new Date();
    const data =
      input.action === 'snooze'
        ? { snoozedUntil: new Date(now.getTime() + CHECK_IN_SNOOZE_DAYS * DAY_MS) }
        : input.action === 'mute'
          ? { checkInsMutedAt: now }
          : input.action === 'unmute'
            ? { checkInsMutedAt: null }
            : input.action === 'end'
              ? { endedAt: now, endReason: input.reason }
              : { endedAt: null, endReason: null };

    await this.prisma.ownership.update({ where: { id: ownership.id }, data });
    await refreshCompanionSchedule(this.prisma, ownership.id, now);
    return this.requireCompanion(userId, productId);
  }

  private async requireCompanion(userId: string, productId: string): Promise<OwnershipCompanionDto> {
    const { companion } = await this.forProduct(userId, productId);
    if (!companion) throw new NotFoundException('Dieses Produkt ist nicht als dein Besitz markiert.');
    return companion;
  }

  private toDto(
    row: CompanionRow,
    report: CompanionReportRow | null,
    now: Date,
  ): OwnershipCompanionDto {
    const journey = journeyFor(row, report, now);
    const nextReminderAt = plannedReminderAt(row, journey);
    return {
      ownershipId: row.id,
      productId: row.productId,
      product: toProductSummaryDto(row.product as ProductWithRelations),
      variantName: row.variant?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      journey,
      nextReminderAt: nextReminderAt?.toISOString() ?? null,
      lastReminderAt: row.reminderSentAt?.toISOString() ?? null,
      snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
      muted: row.checkInsMutedAt !== null,
      endedAt: row.endedAt?.toISOString() ?? null,
      endReason: row.endReason,
      isPublic: report ? report.isPublic : null,
    };
  }
}

/** Due check-ins first, then the soonest next milestone; finished journeys last. */
function companionOrder(a: OwnershipCompanionDto, b: OwnershipCompanionDto): number {
  const rank = (item: OwnershipCompanionDto) =>
    item.endedAt ? 2 : item.journey.due ? 0 : 1;
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank;
  const nextAt = (item: OwnershipCompanionDto) =>
    item.journey.next ? Date.parse(item.journey.next.dueAt) : Number.POSITIVE_INFINITY;
  return nextAt(a) - nextAt(b) || b.createdAt.localeCompare(a.createdAt);
}
