import type { Prisma, PrismaClient } from '@prisma/client';
import {
  buildCheckInJourney,
  nextCheckInReminderAt,
  type CheckInJourney,
  type CompanionCheckInInput,
} from '@wudly/shared';

type Db = PrismaClient | Prisma.TransactionClient;

/** The ownership columns the companion works with. */
export const COMPANION_OWNERSHIP_FIELDS = {
  id: true,
  userId: true,
  productId: true,
  createdAt: true,
  ownedSince: true,
  nextCheckInAt: true,
  reminderSentAt: true,
  snoozedUntil: true,
  checkInsMutedAt: true,
  endedAt: true,
  endReason: true,
} as const;

/** One owner's verdict history for a product: its checkpoints, oldest first. */
export const COMPANION_REPORT_FIELDS = {
  userId: true,
  productId: true,
  wouldBuyAgain: true,
  usageDuration: true,
  experienceMood: true,
  isPublic: true,
  updatedAt: true,
  revisions: {
    select: { createdAt: true, wouldBuyAgain: true, usageDuration: true, experienceMood: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

export type CompanionOwnershipRow = Prisma.OwnershipGetPayload<{
  select: typeof COMPANION_OWNERSHIP_FIELDS;
}>;
export type CompanionReportRow = Prisma.ExperienceReportGetPayload<{
  select: typeof COMPANION_REPORT_FIELDS;
}>;

/** The report's checkpoints — or, for reports older than checkpoints, its current state. */
export function checkInsFromReport(report: CompanionReportRow | null): CompanionCheckInInput[] {
  if (!report) return [];
  if (report.revisions.length > 0) {
    return report.revisions.map((revision) => ({
      at: revision.createdAt,
      wouldBuyAgain: revision.wouldBuyAgain,
      usageDuration: revision.usageDuration,
      experienceMood: revision.experienceMood,
    }));
  }
  return [
    {
      at: report.updatedAt,
      wouldBuyAgain: report.wouldBuyAgain,
      usageDuration: report.usageDuration,
      experienceMood: report.experienceMood,
    },
  ];
}

export function journeyFor(
  ownership: CompanionOwnershipRow,
  report: CompanionReportRow | null,
  now = new Date(),
): CheckInJourney {
  return buildCheckInJourney({
    ownedSince: ownership.ownedSince,
    ownershipCreatedAt: ownership.createdAt,
    checkIns: checkInsFromReport(report),
    endedAt: ownership.endedAt,
    now,
  });
}

/** When the next reminder for this ownership should go out (null = none). */
export function plannedReminderAt(
  ownership: CompanionOwnershipRow,
  journey: CheckInJourney,
  lastReminderAt: Date | null = ownership.reminderSentAt,
): Date | null {
  return nextCheckInReminderAt(journey, {
    ownershipCreatedAt: ownership.createdAt,
    lastReminderAt,
    snoozedUntil: ownership.snoozedUntil,
    muted: ownership.checkInsMutedAt !== null,
    ended: ownership.endedAt !== null,
  });
}

/**
 * Re-plans one ownership after anything that changes its journey — a check-in,
 * a registration, an owner control. Stores the refined start-of-use estimate and
 * the next reminder slot; a snooze is dropped once nothing is due any more.
 */
export async function refreshCompanionSchedule(
  db: Db,
  ownershipId: string,
  now = new Date(),
): Promise<void> {
  const ownership = await db.ownership.findUnique({
    where: { id: ownershipId },
    select: COMPANION_OWNERSHIP_FIELDS,
  });
  if (!ownership) return;
  const report = await db.experienceReport.findUnique({
    where: { userId_productId: { userId: ownership.userId, productId: ownership.productId } },
    select: COMPANION_REPORT_FIELDS,
  });
  const journey = journeyFor(ownership, report, now);
  const snoozedUntil = journey.due ? ownership.snoozedUntil : null;
  await db.ownership.update({
    where: { id: ownership.id },
    data: {
      ownedSince: new Date(journey.startedAt),
      snoozedUntil,
      nextCheckInAt: plannedReminderAt({ ...ownership, snoozedUntil }, journey),
    },
  });
}
