'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import type { QuestionDto, AnswerDto, QuickAnswer } from '@wudly/shared';
import { QUICK_ANSWER_OPTIONS, QUICK_ANSWER_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Card } from './ui/Card';
import { Pill } from './ui/Pill';
import { Button } from './ui/Button';
import { formatDate } from '@/lib/utils';

const quickTone: Record<QuickAnswer, 'positive' | 'negative' | 'unsure' | 'neutral'> = {
  YES: 'positive',
  MOSTLY: 'positive',
  NO: 'negative',
  DEPENDS: 'neutral',
  UNSURE: 'unsure',
};

function AnswerRow({ answer }: { answer: AnswerDto }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [count, setCount] = useState(answer.helpfulCount);
  const [busy, setBusy] = useState(false);

  const markHelpful = async () => {
    if (!user) {
      show('Bitte melde dich an.', 'info');
      return;
    }
    setBusy(true);
    try {
      const updated = await api.questions.markHelpful(answer.id);
      setCount(updated.helpfulCount);
    } catch {
      show('Konnte nicht gespeichert werden.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-md)] bg-fill px-3.5 py-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[0.875rem] font-semibold text-label">
          {answer.authorName ?? 'Besitzer'}
        </span>
        {answer.quickAnswer && (
          <Pill tone={quickTone[answer.quickAnswer]}>{QUICK_ANSWER_LABEL[answer.quickAnswer]}</Pill>
        )}
      </div>
      <p className="text-[0.9375rem] leading-snug text-label">{answer.answerText}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={markHelpful}
          disabled={busy}
          className="tap-dim inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent disabled:opacity-50"
        >
          <ThumbsUp className="h-[0.9rem] w-[0.9rem]" strokeWidth={2.2} /> Hilfreich · {count}
        </button>
        <span className="text-[0.75rem] text-faint">{formatDate(answer.createdAt)}</span>
      </div>
    </div>
  );
}

/** A product question with its answers and an inline answer composer. */
export function QuestionCard({
  question,
  onAnswered,
}: {
  question: QuestionDto;
  /** Called after this user posts an answer (e.g. to drop it from an "open" list). */
  onAnswered?: (answer: AnswerDto) => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [answers, setAnswers] = useState<AnswerDto[]>(question.answers);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [quick, setQuick] = useState<QuickAnswer | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const submitAnswer = async () => {
    if (text.trim().length < 2) return;
    setSubmitting(true);
    try {
      const created = await api.questions.answer(question.id, {
        answerText: text.trim(),
        quickAnswer: quick || undefined,
      });
      setAnswers((prev) => [...prev, created]);
      setText('');
      setQuick('');
      setOpen(false);
      show('Antwort gepostet 🙌', 'success');
      onAnswered?.(created);
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Fehler beim Antworten.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padded className="space-y-3">
      <div>
        <p className="text-[1.0625rem] leading-snug text-label">{question.questionText}</p>
        <p className="mt-0.5 text-[0.8125rem] text-faint">
          {question.authorName ? `${question.authorName} · ` : ''}
          {formatDate(question.createdAt)}
        </p>
      </div>

      {answers.length > 0 && (
        <div className="space-y-2">
          {answers.map((a) => (
            <AnswerRow key={a.id} answer={a} />
          ))}
        </div>
      )}

      {!open ? (
        <button
          onClick={() => {
            if (!user) {
              show('Melde dich an, um zu antworten.', 'info');
              return;
            }
            setOpen(true);
          }}
          className="tap-dim text-[0.9375rem] font-medium text-accent"
        >
          {user ? 'Antworten' : 'Anmelden zum Antworten'}
        </button>
      ) : (
        <div className="space-y-2.5 rounded-[var(--radius-md)] bg-fill p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ANSWER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuick((q) => (q === opt.value ? '' : opt.value))}
                className={`tap-dim rounded-full px-3 py-1 text-[0.8125rem] font-medium transition-colors ${
                  quick === opt.value ? 'bg-accent text-white' : 'bg-surface text-label'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Deine Antwort als Besitzer…"
            rows={3}
            className="w-full rounded-[var(--radius-md)] bg-surface p-3 text-[1.0625rem] text-label outline-none placeholder:text-faint"
          />
          <div className="flex gap-2">
            <Button size="sm" loading={submitting} onClick={submitAnswer}>
              Posten
            </Button>
            <Button size="sm" variant="plain" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {!user && answers.length === 0 && (
        <Link href="/login" className="text-[0.8125rem] text-faint">
          Besitzt du es? Melde dich an und hilf weiter.
        </Link>
      )}
    </Card>
  );
}
