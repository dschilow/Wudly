import { describe, expect, it, vi } from 'vitest';
import { NotificationType } from '@wudly/shared';
import { QuestionsService } from '../src/questions/questions.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { NotificationsService } from '../src/notifications/notifications.service';

describe('QuestionsService owner notifications', () => {
  it('notifies product owners and the product creator, including the asker when they are an owner', async () => {
    const { service, notifications } = createService({
      owners: ['owner-1', 'asker', 'creator'],
      createdByUserId: 'creator',
    });

    await service.createQuestion('product-1', 'asker', {
      questionText: 'Wie ist das Produkt nach ein paar Monaten?',
    });

    expect(notifications.createMany).toHaveBeenCalledOnce();
    expect(notifications.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'owner-1',
        type: NotificationType.QUESTION_ASKED,
        productId: 'product-1',
        questionId: 'question-1',
      }),
      expect.objectContaining({
        userId: 'asker',
        type: NotificationType.QUESTION_ASKED,
        productId: 'product-1',
        questionId: 'question-1',
      }),
      expect.objectContaining({
        userId: 'creator',
        type: NotificationType.QUESTION_ASKED,
        productId: 'product-1',
        questionId: 'question-1',
      }),
    ]);
  });

  it('waits for owner lookup before returning the created question', async () => {
    let releaseOwners!: () => void;
    const owners = new Promise<Array<{ userId: string }>>((resolve) => {
      releaseOwners = () => resolve([{ userId: 'owner-1' }]);
    });
    const { service, notifications } = createService({ owners });

    const created = service.createQuestion('product-1', 'asker', {
      questionText: 'Wie laut ist es im Alltag?',
    });
    const resultBeforeOwners = await Promise.race([
      created.then(() => 'resolved' as const),
      Promise.resolve('pending' as const),
    ]);

    expect(resultBeforeOwners).toBe('pending');
    expect(notifications.createMany).not.toHaveBeenCalled();

    releaseOwners();
    await expect(created).resolves.toMatchObject({ id: 'question-1' });
    expect(notifications.createMany).toHaveBeenCalledOnce();
  });
});

function createService(input: {
  owners: string[] | Promise<Array<{ userId: string }>>;
  createdByUserId?: string | null;
}): {
  service: QuestionsService;
  notifications: Pick<NotificationsService, 'createMany'>;
} {
  const now = new Date('2026-06-07T12:00:00.000Z');
  const ownerRows =
    Array.isArray(input.owners) ? input.owners.map((userId) => ({ userId })) : input.owners;

  const prisma = {
    product: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'product-1',
        canonicalName: 'Test Produkt',
        createdByUserId: input.createdByUserId ?? null,
      }),
    },
    productQuestion: {
      create: vi.fn().mockResolvedValue({
        id: 'question-1',
        productId: 'product-1',
        askedByUserId: 'asker',
        questionText: 'Wie ist das Produkt nach ein paar Monaten?',
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
        askedBy: null,
        answers: [],
      }),
    },
    ownership: {
      findMany: vi.fn().mockResolvedValue(ownerRows),
    },
  };
  const notifications = {
    createMany: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new QuestionsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    ),
    notifications,
  };
}
