import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuyReminderService } from './rebuy-reminder.service';

const DAY = 86_400_000;
/** 12:00 in Berlin — inside the daytime sending window. */
const NOW = new Date('2026-10-24T10:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

function ownership(id: string, createdDaysAgo: number, userId = `user-${id}`) {
  return {
    id,
    userId,
    productId: `product-${id}`,
    createdAt: daysAgo(createdDaysAgo),
    ownedSince: null,
    nextCheckInAt: daysAgo(0),
    reminderSentAt: null,
    snoozedUntil: null,
    checkInsMutedAt: null,
    endedAt: null,
    endReason: null,
    product: { canonicalName: `Produkt ${id}`, status: 'ACTIVE' },
  };
}

/** A verdict given `daysAgo` after "weniger als 1 Woche" of use. */
function report(row: ReturnType<typeof ownership>, givenDaysAgo: number) {
  const at = daysAgo(givenDaysAgo);
  return {
    userId: row.userId,
    productId: row.productId,
    wouldBuyAgain: 'YES',
    usageDuration: 'LESS_THAN_WEEK',
    experienceMood: 'GOOD_DAILY_USE',
    isPublic: true,
    updatedAt: at,
    revisions: [
      {
        createdAt: at,
        wouldBuyAgain: 'YES',
        usageDuration: 'LESS_THAN_WEEK',
        experienceMood: 'GOOD_DAILY_USE',
      },
    ],
  };
}

describe('RebuyReminderService', () => {
  const prisma = {
    ownership: { findMany: vi.fn(), updateMany: vi.fn() },
    experienceReport: { findMany: vi.fn() },
  };
  const notifications = { createMany: vi.fn() };
  const service = () => new RebuyReminderService(prisma as never, notifications as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.ownership.updateMany.mockResolvedValue({ count: 1 });
    notifications.createMany.mockResolvedValue(true);
  });

  it('nudges the milestone that is due with a one-tap check-in', async () => {
    const row = ownership('a', 200);
    prisma.ownership.findMany.mockResolvedValueOnce([row]);
    prisma.experienceReport.findMany.mockResolvedValue([report(row, 200)]);

    await expect(service().runScan(NOW)).resolves.toBe(1);

    const [message] = notifications.createMany.mock.calls[0]![0];
    expect(message).toMatchObject({
      userId: 'user-a',
      type: 'REBUY_REMINDER',
      title: 'Zeit für deinen 6-Monats-Check',
      link: '/products/product-a/own',
      productId: 'product-a',
    });
    expect(message.body).toContain('seit 6 Monaten');
    // Claimed with a compare-and-set and re-planned for the 1-year check.
    expect(prisma.ownership.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', nextCheckInAt: row.nextCheckInAt },
      data: expect.objectContaining({
        reminderSentAt: NOW,
        nextCheckInAt: new Date(daysAgo(200).getTime() + 365 * DAY),
      }),
    });
  });

  it('asks owners without any verdict for their first one', async () => {
    const row = ownership('b', 4);
    prisma.ownership.findMany.mockResolvedValueOnce([row]);
    prisma.experienceReport.findMany.mockResolvedValue([]);

    await expect(service().runScan(NOW)).resolves.toBe(1);
    expect(notifications.createMany.mock.calls[0]![0][0]).toMatchObject({
      title: 'Dein erstes Urteil fehlt noch',
    });
  });

  it('bundles several due check-ins of one owner into a single notification', async () => {
    const first = ownership('c1', 200, 'user-c');
    const second = ownership('c2', 210, 'user-c');
    prisma.ownership.findMany.mockResolvedValueOnce([first, second]);
    prisma.experienceReport.findMany.mockResolvedValue([report(first, 200), report(second, 210)]);

    await expect(service().runScan(NOW)).resolves.toBe(2);
    const messages = notifications.createMany.mock.calls[0]![0];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      userId: 'user-c',
      title: '2 Check-ins sind fällig',
      link: '/me/products',
      productId: null,
    });
  });

  it('only re-plans ownerships whose next milestone is still ahead', async () => {
    const row = ownership('d', 10);
    prisma.ownership.findMany.mockResolvedValueOnce([row]);
    prisma.experienceReport.findMany.mockResolvedValue([report(row, 10)]);

    await expect(service().runScan(NOW)).resolves.toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
    expect(prisma.ownership.updateMany).toHaveBeenCalledWith({
      where: { id: 'd', nextCheckInAt: row.nextCheckInAt },
      data: expect.objectContaining({ nextCheckInAt: new Date(daysAgo(10).getTime() + 30 * DAY) }),
    });
  });

  it('does not send when another replica claimed the reminder first', async () => {
    const row = ownership('e', 200);
    prisma.ownership.findMany.mockResolvedValueOnce([row]);
    prisma.experienceReport.findMany.mockResolvedValue([report(row, 200)]);
    prisma.ownership.updateMany.mockResolvedValue({ count: 0 });

    await expect(service().runScan(NOW)).resolves.toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('releases the claim when the durable inbox write fails', async () => {
    const row = ownership('f', 200);
    prisma.ownership.findMany.mockResolvedValueOnce([row]);
    prisma.experienceReport.findMany.mockResolvedValue([report(row, 200)]);
    notifications.createMany.mockResolvedValue(false);

    await expect(service().runScan(NOW)).resolves.toBe(0);
    expect(prisma.ownership.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'f', reminderSentAt: NOW },
      data: { reminderSentAt: null, snoozedUntil: null, nextCheckInAt: row.nextCheckInAt },
    });
  });

  it('never sends at night', async () => {
    const night = new Date('2026-10-24T01:00:00.000Z'); // 03:00 in Berlin
    await expect(service().runScan(night)).resolves.toBe(0);
    expect(prisma.ownership.findMany).not.toHaveBeenCalled();
  });
});
