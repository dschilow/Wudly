import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QuestionDto, AnswerDto, QuickAnswer } from '@wudly/shared';
import { QUICK_ANSWER_OPTIONS, QUICK_ANSWER_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Chip } from './ui';
import { formatDate } from '@/lib/format';

const quickTone: Record<QuickAnswer, 'positive' | 'negative' | 'neutral'> = {
  YES: 'positive',
  MOSTLY: 'positive',
  NO: 'negative',
  DEPENDS: 'neutral',
  UNSURE: 'neutral',
};

function AnswerRow({ answer }: { answer: AnswerDto }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [count, setCount] = useState(answer.helpfulCount);
  const [busy, setBusy] = useState(false);

  const markHelpful = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const updated = await api.questions.markHelpful(answer.id);
      setCount(updated.helpfulCount);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: colors.accent + '40', paddingLeft: 12, marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text style={{ color: colors.label, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {answer.authorName ?? 'Besitzer'}
        </Text>
        {answer.quickAnswer && <Chip label={QUICK_ANSWER_LABEL[answer.quickAnswer]} tone={quickTone[answer.quickAnswer]} />}
      </View>
      <Text style={{ color: colors.label, fontSize: 15, lineHeight: 20 }}>{answer.answerText}</Text>
      <Pressable onPress={markHelpful} disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <Ionicons name="thumbs-up-outline" size={13} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Hilfreich · {count}</Text>
      </Pressable>
    </View>
  );
}

/** A product question with answers + an inline answer composer. */
export function QuestionCard({
  question,
  onAnswered,
}: {
  question: QuestionDto;
  onAnswered?: (answer: AnswerDto) => void;
}) {
  const { colors, radius } = useTheme();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<AnswerDto[]>(question.answers);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [quick, setQuick] = useState<QuickAnswer | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const submitAnswer = async () => {
    if (text.trim().length < 2 || submitting) return;
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
      onAnswered?.(created);
    } catch (err) {
      // Surfaced inline; keep it simple.
      if (err instanceof ApiError) setText((t) => t);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.label, fontSize: 16, fontWeight: '700', lineHeight: 21 }}>{question.questionText}</Text>
      <Text style={{ color: colors.faint, fontSize: 12, marginTop: 4 }}>
        {question.authorName ? `${question.authorName} · ` : ''}
        {formatDate(question.createdAt)}
        {answers.length > 0 ? ` · ${answers.length} ${answers.length === 1 ? 'Antwort' : 'Antworten'}` : ''}
      </Text>

      {answers.map((a) => (
        <AnswerRow key={a.id} answer={a} />
      ))}

      {!open ? (
        <Pressable onPress={() => user && setOpen(true)} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
            {user ? 'Antworten' : 'Anmelden zum Antworten'}
          </Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: 12, gap: 10, backgroundColor: colors.fill, borderRadius: radius.md, padding: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_ANSWER_OPTIONS.map((opt) => {
              const active = quick === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setQuick((q) => (q === opt.value ? '' : opt.value))}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: radius.pill,
                    backgroundColor: active ? colors.accent : colors.surface,
                  }}
                >
                  <Text style={{ color: active ? '#fff' : colors.label, fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Deine Antwort als Besitzer…"
            placeholderTextColor={colors.faint}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: 12,
              fontSize: 16,
              color: colors.label,
              minHeight: 70,
              textAlignVertical: 'top',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={submitAnswer}
              disabled={submitting}
              style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 18, opacity: submitting ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Posten</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 9, paddingHorizontal: 14 }}>
              <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Abbrechen</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}
