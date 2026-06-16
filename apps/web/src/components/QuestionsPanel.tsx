'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, MessagesSquare } from 'lucide-react';
import type { QuestionDto } from '@wudly/shared';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/states/States';
import { QuestionCard } from '@/components/QuestionCard';

type Filter = 'alle' | 'offen' | 'beantwortet';

/**
 * All questions for a product, summarized and expandable: a clear Alle / Offen /
 * Beantwortet filter with live counts, then an accordion where each question
 * collapses to its headline + status and opens to reveal the owners' answers and
 * the answer composer. Replaces the old flat list so the Q&A reads at a glance.
 */
export function QuestionsPanel({ questions }: { questions: QuestionDto[] }) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [openId, setOpenId] = useState<string | null>(null);

  const answeredCount = useMemo(
    () => questions.filter((q) => q.answers.length > 0).length,
    [questions],
  );
  const openCount = questions.length - answeredCount;

  const filtered = useMemo(() => {
    if (filter === 'offen') return questions.filter((q) => q.answers.length === 0);
    if (filter === 'beantwortet') return questions.filter((q) => q.answers.length > 0);
    return questions;
  }, [questions, filter]);

  if (questions.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<MessagesSquare className="h-7 w-7" strokeWidth={1.8} />}
          title="Noch keine Fragen"
          description="Stell den Besitzern, was dich wirklich interessiert."
        />
      </div>
    );
  }

  const segments: { key: Filter; label: string; count: number }[] = [
    { key: 'alle', label: 'Alle', count: questions.length },
    { key: 'offen', label: 'Offen', count: openCount },
    { key: 'beantwortet', label: 'Beantwortet', count: answeredCount },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {segments.map((s) => {
          const active = s.key === filter;
          return (
            <button
              key={s.key}
              onClick={() => {
                navigator.vibrate?.(5);
                setFilter(s.key);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-fill-2 text-muted-foreground active:opacity-70',
              )}
            >
              {s.label}
              <span
                className={cn(
                  'mono-data text-[0.6875rem]',
                  active ? 'text-primary-foreground/70' : 'text-faint',
                )}
              >
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="card divide-y divide-separator overflow-hidden">
        {filtered.map((q) => {
          const isOpen = openId === q.id;
          const answered = q.answers.length > 0;
          return (
            <div key={q.id}>
              <button
                onClick={() => {
                  navigator.vibrate?.(5);
                  setOpenId(isOpen ? null : q.id);
                }}
                aria-expanded={isOpen}
                className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[1rem] font-semibold leading-snug text-label">
                    {q.questionText}
                  </span>
                  <span className="mono-data mt-1 block text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
                    {formatDate(q.createdAt)}
                    {' · '}
                    {answered
                      ? `${q.answers.length} ${q.answers.length === 1 ? 'Antwort' : 'Antworten'}`
                      : 'Noch offen'}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                    answered
                      ? 'bg-positive-soft text-positive-ink'
                      : 'bg-fill-2 text-muted-foreground',
                  )}
                >
                  {answered ? 'Beantwortet' : 'Offen'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-faint transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                  strokeWidth={2.4}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1">
                      <QuestionCard question={q} embedded />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
