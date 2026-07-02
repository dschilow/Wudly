import { describe, expect, it, vi } from 'vitest';
import { NotificationType } from '@wudly/shared';
import { QuestionsService } from '../src/questions/questions.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { NotificationsService } from '../src/notifications/notifications.service';
import type { EmailService } from '../src/email/email.service';
import type { ConfigService } from '@nestjs/config';

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

describe('QuestionsService.createAnswer notifications', () => {
  it('notifies the asker in-app and by email, but not when answering own question', async () => {
    const { service, notifications, email } = createService({ owners: [] });

    await service.createAnswer('question-1', 'answerer', { answerText: 'Hält seit Monaten super.' });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'asker',
        type: NotificationType.QUESTION_ANSWERED,
        productId: 'product-1',
        questionId: 'question-1',
      }),
    );
    expect(email.send).toHaveBeenCalledOnce();
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'asker@example.test', subject: expect.any(String) }),
    );
  });

  it('does not notify or email when the asker answers their own question', async () => {
    const { service, notifications, email } = createService({
      owners: [],
      askedByUserId: 'same-user',
    });

    await service.createAnswer('question-1', 'same-user', { answerText: 'Update von mir selbst.' });

    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('still creates the answer even if the email send fails', async () => {
    const { service, email } = createService({ owners: [] });
    email.send.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      service.createAnswer('question-1', 'answerer', { answerText: 'Trotzdem gespeichert.' }),
    ).resolves.toMatchObject({ id: 'answer-1' });
  });
});

function createService(input: {
  owners: string[] | Promise<Array<{ userId: string }>>;
  createdByUserId?: string | null;
  askedByUserId?: string | null;
}): {
  service: QuestionsService;
  notifications: Pick<NotificationsService, 'createMany' | 'create'>;
  email: { send: ReturnType<typeof vi.fn> };
} {
  const now = new Date('2026-06-07T12:00:00.000Z');
  const ownerRows =
    Array.isArray(input.owners) ? input.owners.map((userId) => ({ userId })) : input.owners;
  const askedByUserId = input.askedByUserId ?? 'asker';

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
      findUnique: vi.fn().mockResolvedValue({
        id: 'question-1',
        productId: 'product-1',
        askedByUserId,
        questionText: 'Wie ist das Produkt nach ein paar Monaten?',
      }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    productAnswer: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'answer-1',
        questionId: 'question-1',
        productId: 'product-1',
        answeredByUserId: 'answerer',
        answerText: 'Hält seit Monaten super.',
        quickAnswer: null,
        helpfulCount: 0,
        createdAt: now,
        updatedAt: now,
        answeredBy: { id: 'answerer', displayName: 'Answerer' },
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: 'asker@example.test' }),
    },
    ownership: {
      findMany: vi.fn().mockResolvedValue(ownerRows),
    },
  };
  const notifications = {
    createMany: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
  };
  const email = { send: vi.fn().mockResolvedValue(true) };
  const config = { get: vi.fn().mockReturnValue('http://localhost:3000') };

  return {
    service: new QuestionsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      email as unknown as EmailService,
      config as unknown as ConfigService,
    ),
    notifications,
    email,
  };
}
