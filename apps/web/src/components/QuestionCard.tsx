'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, ThumbsUp } from 'lucide-react';
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
    <div className="rounded-2xl bg-surface-sunken p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{answer.authorName ?? 'Besitzer'}</span>
        {answer.quickAnswer && (
          <Pill tone={quickTone[answer.quickAnswer]}>{QUICK_ANSWER_LABEL[answer.quickAnswer]}</Pill>
        )}
      </div>
      <p className="text-sm text-ink/90">{answer.answerText}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={markHelpful}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-border transition-all hover:bg-surface-sunken active:scale-95 disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} /> Hilfreich · {count}
        </button>
        <span className="text-[0.7rem] text-muted-foreground">{formatDate(answer.createdAt)}</span>
      </div>
    </div>
  );
}

/** A product question with its answers and an inline answer composer. */
export function QuestionCard({ question }: { question: QuestionDto }) {
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
    } catch (err) {
      show(err instanceof ApiError ? err.displayMessage : 'Fehler beim Antworten.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padded className="space-y-3">
      <div className="flex items-start gap-2.5">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
        <div className="flex-1">
          <p className="font-semibold text-ink">{question.questionText}</p>
          <p className="text-xs text-muted-foreground">
            {question.authorName ? `von ${question.authorName} · ` : ''}
            {formatDate(question.createdAt)}
          </p>
        </div>
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
          className="text-sm font-semibold text-accent hover:underline"
        >
          {user ? '+ Antworten' : 'Anmelden zum Antworten'}
        </button>
      ) : (
        <div className="space-y-2.5 rounded-2xl bg-surface-sunken p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ANSWER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuick((q) => (q === opt.value ? '' : opt.value))}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                  quick === opt.value
                    ? 'bg-ink text-white ring-ink'
                    : 'bg-surface text-ink ring-border'
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
            className="w-full rounded-xl border border-border-strong bg-surface p-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent"
          />
          <div className="flex gap-2">
            <Button size="sm" loading={submitting} onClick={submitAnswer}>
              Antwort posten
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {!user && answers.length === 0 && (
        <Link href="/login" className="text-xs text-muted-foreground hover:underline">
          Besitzt du es? Melde dich an und hilf weiter.
        </Link>
      )}
    </Card>
  );
}
