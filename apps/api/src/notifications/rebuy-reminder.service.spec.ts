import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RebuyReminderService } from './rebuy-reminder.service';

function dueOwnership(id: string, hasReport: boolean) {
  return {
    id,
    userId: `user-${id}`,
    productId: `product-${id}`,
    product: { canonicalName: `Produkt ${id}` },
    experienceReports: hasReport ? [{ id: `report-${id}` }] : [],
  };
}

describe('RebuyReminderService', () => {
  const prisma = {
    ownership: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const notifications = {
    createMany: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('brings existing contributors back for a receipt-free long-term update', async () => {
    prisma.ownership.findMany.mockResolvedValue([
      dueOwnership('new', false),
      dueOwnership('update', true),
    ]);
    prisma.ownership.updateMany.mockResolvedValue({ count: 1 });
    notifications.createMany.mockResolvedValue(true);
    const service = new RebuyReminderService(prisma as never, notifications as never);

    await expect(service.runScan()).resolves.toBe(2);

    const messages = notifications.createMany.mock.calls[0]?.[0];
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Schon 6 Monate dabei' }),
        expect.objectContaining({
          title: 'Dein Langzeit-Check',
          body: expect.stringContaining('ganz ohne Rechnung'),
        }),
      ]),
    );
  });

  it('does not send when another replica claimed the reminder first', async () => {
    prisma.ownership.findMany.mockResolvedValue([dueOwnership('race', true)]);
    prisma.ownership.updateMany.mockResolvedValue({ count: 0 });
    const service = new RebuyReminderService(prisma as never, notifications as never);

    await expect(service.runScan()).resolves.toBe(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('releases the claim when the durable inbox write fails', async () => {
    prisma.ownership.findMany.mockResolvedValue([dueOwnership('retry', true)]);
    prisma.ownership.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    notifications.createMany.mockResolvedValue(false);
    const service = new RebuyReminderService(prisma as never, notifications as never);

    await expect(service.runScan()).resolves.toBe(0);
    expect(prisma.ownership.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { reminderSentAt: null } }),
    );
  });
});
