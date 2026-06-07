'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, MessageCircleQuestion, ThumbsUp, Package, Clock3 } from 'lucide-react';
import type {
  NotificationDto,
  NotificationListDto,
  OpenQuestionDto,
  NotificationType,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications-context';
import { AuthGate } from '@/components/AuthGate';
import { PushOptIn } from '@/components/PushOptIn';
import { QuestionCard } from '@/components/QuestionCard';
import { EmptyState, Skeleton } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { formatRelativeTime } from '@/lib/utils';

const typeIcon: Record<NotificationType, typeof Bell> = {
  QUESTION_ASKED: MessageCircleQuestion,
  QUESTION_ANSWERED: MessageCircleQuestion,
  ANSWER_HELPFUL: ThumbsUp,
  REBUY_REMINDER: Clock3,
};

export function InboxClient() {
  const { user, loading: authLoading } = useAuth();
  const { refresh: refreshBadge, clear } = useNotifications();

  const [data, setData] = useState<NotificationListDto | null>(null);
  const [openQuestions, setOpenQuestions] = useState<OpenQuestionDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, open] = await Promise.all([
        api.notifications.list(30, { cache: 'no-store' }),
        api.notifications.openQuestions({ cache: 'no-store' }),
      ]);
      setData(list);
      setOpenQuestions(open);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  // Mark everything read once the inbox is viewed (and reflect it in the badge).
  useEffect(() => {
    if (!data || data.unreadCount === 0) return;
    void api.notifications.markAllRead().then(() => {
      clear();
      void refreshBadge();
    });
  }, [data, clear, refreshBadge]);

  if (!authLoading && !user) {
    return (
      <AuthGate
        title="Mitteilungen"
        description="Melde dich an, um Fragen zu deinen Produkten und Antworten auf deine Fragen zu sehen."
        redirect="/me/inbox"
      />
    );
  }

  const removeAnsweredQuestion = (questionId: string) =>
    setOpenQuestions((prev) => prev?.filter((oq) => oq.question.id !== questionId) ?? null);

  return (
    <div className="animate-fade space-y-7 pt-2">
      <LargeTitle title="Mitteilungen" subtitle="Fragen an dich & Antworten für dich." />

      <PushOptIn />

      {loading && !data ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : (
        <>
          {/* Open questions on products I own — the "answer the owner" inbox */}
          {openQuestions && openQuestions.length > 0 && (
            <section className="space-y-2.5">
              <SectionLabel>Fragen zu deinen Produkten · {openQuestions.length}</SectionLabel>
              {openQuestions.map((oq) => (
                <div key={oq.question.id} className="space-y-1.5">
                  <Link
                    href={`/products/${oq.product.id}`}
                    className="tap-dim flex items-center gap-2 px-1 text-[0.8125rem] text-muted-foreground"
                  >
                    <Package className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    <span className="truncate">{oq.product.canonicalName}</span>
                  </Link>
                  <QuestionCard
                    question={oq.question}
                    onAnswered={() => {
                      removeAnsweredQuestion(oq.question.id);
                      void refreshBadge();
                    }}
                  />
                </div>
              ))}
            </section>
          )}

          {/* Notification feed */}
          <section className="space-y-2.5">
            <SectionLabel>Aktivität</SectionLabel>
            {data && data.items.length > 0 ? (
              <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface">
                {data.items.map((n, i) => (
                  <NotificationRow key={n.id} notification={n} last={i === data.items.length - 1} />
                ))}
              </div>
            ) : (
              openQuestions?.length === 0 && (
                <div className="rounded-[var(--radius-lg)] bg-surface">
                  <EmptyState
                    title="Noch nichts hier"
                    description="Wenn jemand zu deinen Produkten fragt oder deine Frage beantwortet, erscheint es hier."
                  />
                </div>
              )
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[0.8125rem] uppercase tracking-[0.02em] text-muted-foreground">
      {children}
    </h2>
  );
}

function NotificationRow({ notification, last }: { notification: NotificationDto; last: boolean }) {
  const Icon = typeIcon[notification.type] ?? Bell;
  const body = (
    <div
      className={'flex items-start gap-3 px-4 py-3 ' + (last ? '' : 'hairline')}
      style={{ ['--hairline-inset' as string]: '3.25rem' }}
    >
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        {notification.type === 'ANSWER_HELPFUL' ? (
          <ThumbsUp className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.1} />
        ) : (
          <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.1} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-[0.9375rem] font-medium leading-snug text-label">
            {notification.title}
          </p>
          {!notification.read && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              aria-label="ungelesen"
            />
          )}
        </div>
        {notification.body && (
          <p className="mt-0.5 truncate text-[0.875rem] text-muted-foreground">
            {notification.body}
          </p>
        )}
        <p className="mt-0.5 text-[0.75rem] text-faint">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  return notification.link ? (
    <Link href={notification.link} className="tap block">
      {body}
    </Link>
  ) : (
    body
  );
}
