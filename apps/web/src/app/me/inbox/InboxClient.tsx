'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  MessageCircleQuestion,
  Send,
  ThumbsUp,
  UsersRound,
  X,
} from 'lucide-react';
import {
  QUICK_ANSWER_LABEL,
  QUICK_ANSWER_OPTIONS,
  type AnswerDto,
  type GroupedNotificationInboxDto,
  type InboxQuestionDto,
  type NotificationDto,
  type NotificationProductGroupDto,
  type QuickAnswer,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications-context';
import { useToast } from '@/components/ui/Toast';
import { AuthGate } from '@/components/AuthGate';
import { PushOptIn } from '@/components/PushOptIn';
import { EmptyState, Skeleton } from '@/components/states/States';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { Sheet } from '@/components/ui/Sheet';
import { Thumb } from '@/components/Thumb';
import { Button } from '@/components/ui/Button';
import { formatDate, formatRelativeTime } from '@/lib/utils';

export function InboxClient() {
  const { user, loading: authLoading } = useAuth();
  const { refresh: refreshBadge } = useNotifications();
  const [inbox, setInbox] = useState<GroupedNotificationInboxDto | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInbox(await api.notifications.grouped({ cache: 'no-store' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  useEffect(() => {
    if (!inbox || selectedProductId || typeof window === 'undefined') return;
    const productId = new URLSearchParams(window.location.search).get('product');
    const questionId = new URLSearchParams(window.location.search).get('question');
    if (!productId) return;
    const group = inbox.groups.find((item) => item.product.id === productId);
    if (group) {
      setSelectedQuestionId(questionId);
      void openGroup(group, questionId);
    }
    // This effect intentionally reacts only when the grouped inbox arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox, selectedProductId]);

  const selectedGroup = useMemo(
    () => inbox?.groups.find((group) => group.product.id === selectedProductId) ?? null,
    [inbox, selectedProductId],
  );

  const openGroup = async (group: NotificationProductGroupDto, questionId?: string | null) => {
    setSelectedProductId(group.product.id);
    setSelectedQuestionId(questionId ?? group.notifications[0]?.questionId ?? null);
    if (group.unreadCount === 0) return;
    setInbox((current) =>
      current
        ? {
            ...current,
            unreadCount: Math.max(0, current.unreadCount - group.unreadCount),
            groups: current.groups.map((item) =>
              item.product.id === group.product.id
                ? {
                    ...item,
                    unreadCount: 0,
                    notifications: item.notifications.map((notification) => ({
                      ...notification,
                      read: true,
                    })),
                  }
                : item,
            ),
          }
        : current,
    );
    await api.notifications.markProductRead(group.product.id).catch(() => undefined);
    await refreshBadge();
  };

  const handleAnswered = (productId: string, questionId: string, answer: AnswerDto) => {
    setInbox((current) =>
      current
        ? {
            ...current,
            groups: current.groups.map((group) =>
              group.product.id !== productId
                ? group
                : {
                    ...group,
                    questions: group.questions.map((question) =>
                      question.id === questionId
                        ? {
                            ...question,
                            answers: [...question.answers, answer],
                            answerCount: question.answerCount + 1,
                            answeredByMe: true,
                            canAnswer: false,
                            status: 'ANSWERED',
                          }
                        : question,
                    ),
                  },
            ),
          }
        : current,
    );
    void refreshBadge();
  };

  if (!authLoading && !user) {
    return (
      <AuthGate
        title="Mitteilungen"
        description="Melde dich an, um Fragen zu deinen Produkten und Antworten auf deine Fragen zu sehen."
        redirect="/me/inbox"
      />
    );
  }

  return (
    <div className="space-y-7 pt-2">
      <LargeTitle
        title="Mitteilungen"
        subtitle="Nach Produkten sortiert. Fragen beantworten, ohne den Kontext zu verlassen."
      />
      <PushOptIn />

      {loading && !inbox ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : inbox && inbox.groups.length > 0 ? (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065 } } }}
        >
          {inbox.groups.map((group) => (
            <ProductNotificationCard key={group.product.id} group={group} onOpen={openGroup} />
          ))}
        </motion.div>
      ) : (
        <div className="rounded-[var(--radius-lg)] bg-surface">
          <EmptyState
            icon={<Bell className="h-7 w-7" strokeWidth={1.8} />}
            title="Noch nichts hier"
            description="Neue Fragen und Antworten erscheinen automatisch gesammelt beim jeweiligen Produkt."
          />
        </div>
      )}

      {inbox && inbox.ungrouped.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="px-1 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Allgemein
          </h2>
          <div className="card divide-y divide-border overflow-hidden">
            {inbox.ungrouped.map((notification) => (
              <GeneralNotification key={notification.id} notification={notification} />
            ))}
          </div>
        </section>
      )}

      <Sheet
        open={Boolean(selectedGroup)}
        onClose={() => {
          setSelectedProductId(null);
          setSelectedQuestionId(null);
        }}
        ariaLabel={selectedGroup ? `Fragen zu ${selectedGroup.product.canonicalName}` : 'Fragen'}
      >
        {selectedGroup && (
          <ProductInboxSheet
            group={selectedGroup}
            focusQuestionId={selectedQuestionId}
            onClose={() => {
              setSelectedProductId(null);
              setSelectedQuestionId(null);
            }}
            onAnswered={(questionId, answer) =>
              handleAnswered(selectedGroup.product.id, questionId, answer)
            }
          />
        )}
      </Sheet>
    </div>
  );
}

function ProductNotificationCard({
  group,
  onOpen,
}: {
  group: NotificationProductGroupDto;
  onOpen: (group: NotificationProductGroupDto) => void;
}) {
  const pending = group.questions.filter((question) => question.canAnswer).length;
  const latest = group.notifications[0];
  const totalAnswers = group.questions.reduce((sum, question) => sum + question.answerCount, 0);

  return (
    <motion.button
      type="button"
      layout
      variants={{
        hidden: { opacity: 0, y: 18, scale: 0.985 },
        show: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => void onOpen(group)}
      className="group relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-left shadow-[0_10px_30px_-24px_rgba(0,0,0,0.8)]"
    >
      {group.unreadCount > 0 && (
        <motion.span
          layoutId={`unread-glow-${group.product.id}`}
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-accent shadow-[0_0_24px_var(--color-accent)]"
        />
      )}
      <div className="flex items-start gap-3.5">
        <Thumb product={group.product} className="h-14 w-14" fit="contain" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-semibold text-label">
                {group.product.canonicalName}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-faint">
                {formatRelativeTime(group.latestAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {group.unreadCount > 0 && (
                <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[0.6875rem] font-bold text-[#04140d]">
                  {group.unreadCount}
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-label-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-[0.875rem] leading-snug text-muted-foreground">
            {latest?.body ?? latest?.title ?? 'Fragen und Antworten zu diesem Produkt'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MetricPill icon={MessageCircleQuestion} label={`${group.questions.length} Fragen`} />
            <MetricPill icon={UsersRound} label={`${totalAnswers} Antworten`} />
            {pending > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.75rem] font-semibold text-accent-ink">
                <Send className="h-3 w-3" aria-hidden />
                {pending} für dich offen
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function MetricPill({ icon: Icon, label }: { icon: typeof Bell; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-2.5 py-1 text-[0.75rem] text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function ProductInboxSheet({
  group,
  focusQuestionId,
  onClose,
  onAnswered,
}: {
  group: NotificationProductGroupDto;
  focusQuestionId: string | null;
  onClose: () => void;
  onAnswered: (questionId: string, answer: AnswerDto) => void;
}) {
  const pending = group.questions.filter((question) => question.canAnswer);
  const primaryQuestion =
    group.questions.find((question) => question.id === focusQuestionId) ??
    pending[0] ??
    group.questions[0] ??
    null;

  return (
    <motion.div layout className="space-y-6 pb-2">
      <header className="sticky top-0 z-10 -mx-5 -mt-2 border-b border-border bg-canvas/90 px-5 pb-4 pt-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Thumb product={group.product} className="h-12 w-12" fit="contain" />
          <div className="min-w-0 flex-1">
            <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-accent">
              Produkt-Inbox
            </p>
            <h2 className="truncate text-[1.125rem] font-semibold text-label">
              {group.product.canonicalName}
            </h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.86, rotate: -8 }}
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full bg-fill-2 text-label"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>
      </header>

      {primaryQuestion ? (
        <section className="space-y-3">
          <div>
            <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              {primaryQuestion.canAnswer ? 'Deine Antwort wird gesucht' : 'Aktuelle Frage'}
            </p>
            <h3 className="mt-1 text-[1.25rem] font-semibold leading-tight text-label">
              {primaryQuestion.questionText}
            </h3>
          </div>
          <AnswerProgress question={primaryQuestion} prominent />
          {primaryQuestion.canAnswer && (
            <AnswerComposer question={primaryQuestion} onAnswered={onAnswered} />
          )}
        </section>
      ) : (
        <div className="rounded-[var(--radius-lg)] bg-fill-1 p-5 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-positive" />
          <p className="mt-2 font-semibold text-label">Keine offenen Fragen</p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Produktwissen
            </p>
            <h3 className="mt-1 text-[1.0625rem] font-semibold text-label">
              Bereits gestellte Fragen
            </h3>
          </div>
          <span className="text-[0.8125rem] text-muted-foreground">
            {group.questions.length} gesamt
          </span>
        </div>
        <motion.div layout className="space-y-2.5">
          {group.questions.map((question) => (
            <QuestionOverview
              key={question.id}
              question={question}
              initiallyOpen={question.id === primaryQuestion?.id}
              onAnswered={onAnswered}
            />
          ))}
        </motion.div>
      </section>

      {group.notifications.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Verlauf
            </p>
            <h3 className="mt-1 text-[1.0625rem] font-semibold text-label">
              Nachrichten zu diesem Produkt
            </h3>
          </div>
          <div className="relative space-y-0 pl-3">
            <span className="absolute bottom-4 left-[1.15rem] top-4 w-px bg-border" aria-hidden />
            {group.notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.045 }}
                className="relative flex gap-3 py-3"
              >
                <span className="relative z-[1] mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-canvas bg-accent" />
                <div>
                  <p className="text-[0.875rem] font-medium text-label">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">
                      {notification.body}
                    </p>
                  )}
                  <p className="mt-1 text-[0.6875rem] text-faint">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <Link
        href={`/products/${group.product.id}`}
        className="press flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-fill-2 text-[0.9375rem] font-semibold text-label"
      >
        Ganze Produktseite öffnen
      </Link>
    </motion.div>
  );
}

function AnswerProgress({ question, prominent = false }: { question: InboxQuestionDto; prominent?: boolean }) {
  const denominator = Math.max(question.ownerCount, question.answerCount, 1);
  const percent = Math.min(100, Math.round((question.answerCount / denominator) * 100));
  return (
    <div className={prominent ? 'rounded-[var(--radius-lg)] bg-fill-1 p-4' : 'space-y-1.5'}>
      <div className="flex items-center justify-between gap-3 text-[0.8125rem]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <UsersRound className="h-3.5 w-3.5" aria-hidden /> Antwortfortschritt
        </span>
        <span className="font-semibold text-label">
          {question.answerCount} von {question.ownerCount || '?'} Besitzern
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill-2">
        <motion.span
          className="block h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 130, damping: 20, delay: 0.12 }}
        />
      </div>
    </div>
  );
}

function QuestionOverview({
  question,
  initiallyOpen,
  onAnswered,
}: {
  question: InboxQuestionDto;
  initiallyOpen: boolean;
  onAnswered: (questionId: string, answer: AnswerDto) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <motion.article layout className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      <motion.button
        layout="position"
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-start gap-3 p-4 text-left"
      >
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${question.canAnswer ? 'bg-accent-soft text-accent-ink' : question.answeredByMe ? 'bg-positive-soft text-positive-ink' : 'bg-fill-2 text-muted-foreground'}`}>
          {question.answeredByMe ? <Check className="h-4 w-4" /> : <MessageCircleQuestion className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium leading-snug text-label">
            {question.questionText}
          </span>
          <span className="mt-1 block text-[0.75rem] text-muted-foreground">
            {question.answerCount} {question.answerCount === 1 ? 'Antwort' : 'Antworten'}
            {question.answeredByMe ? ' · von dir beantwortet' : question.canAnswer ? ' · offen für dich' : ''}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronDown className="h-5 w-5 text-label-3" />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: 'spring', stiffness: 360, damping: 36 }, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
              <AnswerProgress question={question} />
              {question.answers.length > 0 && (
                <div className="space-y-2.5">
                  {question.answers.map((answer) => (
                    <div key={answer.id} className="rounded-xl bg-fill-1 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.75rem] font-semibold text-label">
                          {answer.authorName ?? 'Besitzer'}
                        </span>
                        {answer.quickAnswer && (
                          <span className="rounded-full bg-fill-2 px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                            {QUICK_ANSWER_LABEL[answer.quickAnswer]}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[0.875rem] leading-snug text-label">{answer.answerText}</p>
                      <p className="mt-1.5 text-[0.6875rem] text-faint">{formatDate(answer.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
              {question.canAnswer && <AnswerComposer question={question} onAnswered={onAnswered} compact />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function AnswerComposer({
  question,
  onAnswered,
  compact = false,
}: {
  question: InboxQuestionDto;
  onAnswered: (questionId: string, answer: AnswerDto) => void;
  compact?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const { show } = useToast();
  const [quick, setQuick] = useState<QuickAnswer | ''>('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (text.trim().length < 2) {
      show('Schreib bitte noch einen kurzen Satz dazu.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      const answer = await api.questions.answer(question.id, {
        answerText: text.trim(),
        quickAnswer: quick || undefined,
      });
      onAnswered(question.id, answer);
      setText('');
      setQuick('');
      show('Antwort veröffentlicht', 'success');
    } catch (error) {
      show(error instanceof ApiError ? error.displayMessage : 'Antwort konnte nicht gespeichert werden.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`rounded-[var(--radius-lg)] border border-accent/20 bg-accent/5 ${compact ? 'p-3' : 'p-4'}`}
    >
      <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-label">
        <Send className="h-4 w-4 text-accent" aria-hidden /> Deine Erfahrung als Besitzer
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_ANSWER_OPTIONS.map((option) => (
          <motion.button
            key={option.value}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setQuick((current) => (current === option.value ? '' : option.value))}
            className={`min-h-10 rounded-full px-3 text-[0.8125rem] font-medium transition-colors ${quick === option.value ? 'bg-accent text-[#04140d] shadow-[var(--shadow-glow)]' : 'bg-surface text-label ring-1 ring-border'}`}
          >
            {option.label}
          </motion.button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={compact ? 2 : 3}
        placeholder="Was sollte man aus deiner Nutzung wissen?"
        className="mt-3 w-full resize-none rounded-[var(--radius-md)] bg-surface p-3 text-[1rem] leading-relaxed text-label outline-none ring-1 ring-border transition focus:ring-2 focus:ring-accent/60 placeholder:text-faint"
      />
      <Button fullWidth variant="brand" loading={submitting} disabled={text.trim().length < 2} onClick={() => void submit()} className="mt-3">
        Antwort senden
      </Button>
    </motion.div>
  );
}

function GeneralNotification({ notification }: { notification: NotificationDto }) {
  const Icon = notification.type === 'ANSWER_HELPFUL' ? ThumbsUp : Clock3;
  const content = (
    <div className="flex min-h-16 items-start gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-label">{notification.title}</span>
        {notification.body && <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{notification.body}</span>}
      </span>
    </div>
  );
  return notification.link ? <Link href={notification.link}>{content}</Link> : content;
}
