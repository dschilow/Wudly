'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, ShieldCheck, ThumbsUp } from 'lucide-react';
import type { QuestionDto, AnswerDto, QuickAnswer } from '@wudly/shared';
import { QUICK_ANSWER_OPTIONS, QUICK_ANSWER_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
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
  const [markedHelpful, setMarkedHelpful] = useState(false);

  const isOwnAnswer = user?.id === answer.answeredByUserId;
  const isOwner = answer.authorType === 'OWNER';
  const authorLabel =
    answer.authorName ??
    (isOwner ? 'Besitzer' : answer.authorType === 'WUDLY_TEAM' ? 'Wudly-Team' : 'Community');
  const ownerTrustLabel =
    answer.verificationStatus === 'VERIFIED'
      ? answer.verificationMethod === 'CONTINUITY'
        ? 'Besitz durch Langzeit-Updates plausibilisiert'
        : 'Besitz durch Wudly geprüft'
      : 'Besitz selbst angegeben';

  const markHelpful = async () => {
    if (!user) {
      show('Bitte melde dich an.', 'info');
      return;
    }
    setBusy(true);
    try {
      const updated = await api.questions.markHelpful(answer.id);
      setCount(updated.helpfulCount);
      setMarkedHelpful(true);
    } catch (error) {
      show(
        error instanceof ApiError ? error.displayMessage : 'Konnte nicht gespeichert werden.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-l-2 border-accent/30 pl-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="mono-data text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-label">
          {authorLabel}
        </span>
        {isOwner && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-[0.6875rem] font-semibold text-accent-ink">
            {answer.verificationStatus === 'VERIFIED' ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            )}
            {ownerTrustLabel}
          </span>
        )}
        {answer.authorType === 'WUDLY_TEAM' && (
          <Pill tone="neutral">Wudly-Team · keine Besitzerstimme</Pill>
        )}
        {answer.quickAnswer && (
          <Pill tone={quickTone[answer.quickAnswer]}>{QUICK_ANSWER_LABEL[answer.quickAnswer]}</Pill>
        )}
      </div>
      {isOwner && (
        <p className="mono-data mb-1.5 text-[0.6875rem] text-muted-foreground">
          {answer.ownerSince && <>Besitz eingetragen seit {formatDate(answer.ownerSince)}</>}
          {answer.ownerSince && answer.contributionCount > 0 && ' · '}
          {answer.contributionCount}{' '}
          {answer.contributionCount === 1 ? 'Besitzerantwort' : 'Besitzerantworten'}
        </p>
      )}
      <p className="text-[0.9375rem] leading-relaxed text-label">{answer.answerText}</p>
      <div className="mt-2 flex items-center gap-3">
        {!isOwnAnswer ? (
          <button
            type="button"
            onClick={markHelpful}
            disabled={busy || markedHelpful}
            aria-label={
              markedHelpful
                ? `Als hilfreich markiert. ${count} Stimmen`
                : `Antwort als hilfreich markieren. Bisher ${count} Stimmen`
            }
            className="tap-dim mono-data inline-flex min-h-11 items-center gap-1.5 rounded-full pr-2 text-[0.75rem] font-medium text-accent disabled:text-muted-foreground"
          >
            <ThumbsUp className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            {markedHelpful ? 'Hilfreich markiert' : 'Hilfreich'} · {count}
          </button>
        ) : (
          <span className="mono-data inline-flex min-h-11 items-center gap-1.5 text-[0.75rem] text-muted-foreground">
            <ThumbsUp className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Hilfreich · {count}
          </span>
        )}
        <span className="mono-data text-[0.6875rem] text-muted-foreground">
          {formatDate(answer.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function QuestionCard({
  question,
  onAnswered,
  embedded = false,
  canAnswer = false,
}: {
  question: QuestionDto;
  onAnswered?: (answer: AnswerDto) => void;
  embedded?: boolean;
  canAnswer?: boolean;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [answers, setAnswers] = useState<AnswerDto[]>(question.answers);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [quick, setQuick] = useState<QuickAnswer | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const textareaId = `answer-${question.id}`;

  const submitAnswer = async () => {
    if (text.trim().length < 2) {
      show('Schreib bitte noch einen kurzen Satz dazu.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.questions.answer(question.id, {
        answerText: text.trim(),
        quickAnswer: quick || undefined,
      });
      setAnswers((previous) => [...previous, created]);
      setText('');
      setQuick('');
      setOpen(false);
      show('Deine Besitzerantwort ist veröffentlicht.', 'success');
      onAnswered?.(created);
    } catch (error) {
      show(error instanceof ApiError ? error.displayMessage : 'Fehler beim Antworten.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className={embedded ? 'space-y-3.5' : 'card space-y-3.5 p-4'}>
      {!embedded && (
        <div>
          <p className="text-[1.0625rem] font-semibold leading-snug text-label">
            {question.questionText}
          </p>
          <p className="mono-data mt-1 text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground">
            {question.authorName ? `${question.authorName} · ` : ''}
            {formatDate(question.createdAt)}
            {answers.length > 0 &&
              ` · ${answers.length} ${answers.length === 1 ? 'Antwort' : 'Antworten'}`}
          </p>
        </div>
      )}

      {answers.length > 0 && (
        <div className="space-y-4">
          {answers.map((answer) => (
            <AnswerRow key={answer.id} answer={answer} />
          ))}
        </div>
      )}

      {!open ? (
        <>
          {!user && (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-[0.9375rem] font-medium text-accent"
            >
              Anmelden, um als Besitzer zu antworten
            </Link>
          )}
          {user && canAnswer && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="tap-dim min-h-11 text-[0.9375rem] font-medium text-accent"
            >
              Als Besitzer antworten
            </button>
          )}
          {user && !canAnswer && (
            <Link
              href={`/products/${question.productId}/own`}
              className="inline-flex min-h-11 items-center rounded-full bg-accent-soft px-4 text-[0.875rem] font-semibold text-accent-ink"
            >
              Produkt eintragen und antworten
            </Link>
          )}
        </>
      ) : (
        <div className="space-y-3 rounded-[var(--radius-md)] bg-fill p-3">
          <p className="text-[0.8125rem] leading-snug text-muted-foreground">
            Antworte nur aus deiner eigenen Nutzung. Variante und Besitzstatus werden transparent
            angezeigt.
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Kurzeinschätzung">
            {QUICK_ANSWER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setQuick((current) => (current === option.value ? '' : option.value))
                }
                aria-pressed={quick === option.value}
                className={`tap-dim min-h-11 rounded-full px-3 text-[0.8125rem] font-medium transition-colors ${
                  quick === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface text-label'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label htmlFor={textareaId} className="block text-[0.8125rem] font-semibold text-label">
            Was sollte man aus deiner Nutzung wissen?
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Kurz, konkret und ehrlich antworten …"
            rows={3}
            className="w-full rounded-[var(--radius-md)] bg-surface p-3 text-[1rem] leading-relaxed text-label outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex gap-2">
            <Button size="sm" loading={submitting} onClick={submitAnswer}>
              Besitzerantwort veröffentlichen
            </Button>
            <Button size="sm" variant="plain" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
