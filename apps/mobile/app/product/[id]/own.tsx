import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type {
  CategoryAspectDto,
  ProductPromptDto,
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
} from '@wudly/shared';
import {
  WOULD_BUY_AGAIN_OPTIONS,
  USAGE_DURATION_OPTIONS,
  EXPERIENCE_MOOD_OPTIONS,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { OptionGrid, MultiSelectChips } from '@/components/OptionGrid';
import { Button, Center, Muted } from '@/components/ui';

const TOTAL_STEPS = 4;

/** "Ich besitze es" — the 4-step experience wizard, ported from the web flow. */
export default function OwnExperienceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, loading: authLoading } = useAuth();

  const [productName, setProductName] = useState('');
  const [aspects, setAspects] = useState<CategoryAspectDto[]>([]);
  const [prompts, setPrompts] = useState<ProductPromptDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buyAgain, setBuyAgain] = useState<WouldBuyAgain | null>(null);
  const [duration, setDuration] = useState<UsageDuration | null>(null);
  const [mood, setMood] = useState<ExperienceMood | null>(null);
  const [wish, setWish] = useState('');
  const [insteadOf, setInsteadOf] = useState('');
  const [positives, setPositives] = useState<string[]>([]);
  const [negatives, setNegatives] = useState<string[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, { answerLabel: string; isCustom: boolean }>>({});
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: 'Ich besitze es' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const product = await api.products.get(id);
      setProductName(product.canonicalName);
      if (product.category) {
        const all = await api.categories.aspects().catch(() => ({}) as Record<string, CategoryAspectDto[]>);
        setAspects(all[product.category.slug] ?? []);
      }
      void api.products.prompts(id).then(setPrompts).catch(() => {});
    } catch {
      /* keep wizard usable even if aspects fail */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const positiveAspects = aspects.filter((a) => a.type !== 'NEGATIVE');
  const negativeAspects = aspects.filter((a) => a.type !== 'POSITIVE');

  const togglePositive = (key: string) => {
    setNegatives((n) => n.filter((k) => k !== key));
    setPositives((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };
  const toggleNegative = (key: string) => {
    setPositives((p) => p.filter((k) => k !== key));
    setNegatives((n) => (n.includes(key) ? n.filter((k) => k !== key) : [...n, key]));
  };

  const setPromptAnswer = (promptId: string, answerLabel: string, isCustom = false) => {
    setPromptAnswers((prev) => {
      const label = answerLabel.trim();
      if (!label) {
        const next = { ...prev };
        delete next[promptId];
        return next;
      }
      return { ...prev, [promptId]: { answerLabel: label, isCustom } };
    });
  };

  const canNext =
    (step === 1 && buyAgain) || (step === 2 && duration) || (step === 3 && mood) || step === 4;

  const submit = async () => {
    if (!buyAgain || !duration || !mood) return;
    if (!user) {
      // Rating is already captured; ask to sign in, then come back here.
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const promptResponses = Object.entries(promptAnswers).map(([promptId, answer]) => ({
        promptId,
        answerLabel: answer.answerLabel,
        isCustom: answer.isCustom,
      }));
      await api.experiences.create(id!, {
        wouldBuyAgain: buyAgain,
        usageDuration: duration,
        experienceMood: mood,
        wishKnownText: wish.trim() || undefined,
        insteadOfText: insteadOf.trim() || undefined,
        positiveAspects: positives.length ? positives : undefined,
        negativeAspects: negatives.length ? negatives : undefined,
        promptResponses: promptResponses.length ? promptResponses : undefined,
        isPublic,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 16 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.positive,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800' }}>Danke!</Text>
          <Muted style={{ textAlign: 'center' }}>
            Deine Erfahrung mit {productName} zählt jetzt zum Wudly Signal — und in dein Kaufprofil.
          </Muted>
          <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
            <Button title="Produktseite ansehen" onPress={() => router.replace(`/product/${id}`)} />
            <Button title="Fertig" variant="soft" onPress={() => router.dismissAll?.() ?? router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const titles = [
    'Würdest du es wieder kaufen?',
    'Wie lange nutzt du es?',
    'Was trifft am besten zu?',
    'Was hättest du gern vorher gewusst?',
  ];

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 16,
    color: colors.label,
  } as const;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Progress segments */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.accent : colors.fill2 }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 24, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={{ color: colors.faint, fontSize: 13 }}>
            Schritt {step} von {TOTAL_STEPS}
            {step === 4 ? ' · optional' : ''}
          </Text>
          <Text style={{ color: colors.label, fontSize: 24, fontWeight: '800', marginTop: 4 }}>
            {titles[step - 1]}
          </Text>
        </View>

        {step === 1 && <OptionGrid options={WOULD_BUY_AGAIN_OPTIONS} value={buyAgain} onChange={setBuyAgain} />}
        {step === 2 && <OptionGrid options={USAGE_DURATION_OPTIONS} value={duration} onChange={setDuration} />}
        {step === 3 && <OptionGrid options={EXPERIENCE_MOOD_OPTIONS} value={mood} onChange={setMood} />}

        {step === 4 && (
          <View style={{ gap: spacing.lg }}>
            <View>
              <Label text="Was hättest du gern vorher gewusst?" />
              <TextInput
                value={wish}
                onChangeText={setWish}
                multiline
                numberOfLines={3}
                placeholder="z. B. Dass die Station ziemlich groß ist…"
                placeholderTextColor={colors.faint}
                style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              />
            </View>
            <View>
              <Label text="Hättest du lieber etwas anderes gekauft?" />
              <TextInput
                value={insteadOf}
                onChangeText={setInsteadOf}
                maxLength={160}
                placeholder="z. B. Roborock S8 — sonst leer lassen"
                placeholderTextColor={colors.faint}
                style={inputStyle}
              />
            </View>
            {positiveAspects.length > 0 && (
              <View>
                <Label text="Was gefällt dir?" />
                <MultiSelectChips options={positiveAspects} selected={positives} onToggle={togglePositive} tone="positive" />
              </View>
            )}
            {negativeAspects.length > 0 && (
              <View>
                <Label text="Was nervt?" />
                <MultiSelectChips options={negativeAspects} selected={negatives} onToggle={toggleNegative} tone="negative" />
              </View>
            )}
            {prompts.length > 0 && (
              <View style={{ gap: spacing.md }}>
                <Label text="Das wollen Kaeufer wissen" />
                {prompts.slice(0, 4).map((prompt) => (
                  <PromptAnswerCard
                    key={prompt.id}
                    prompt={prompt}
                    selected={promptAnswers[prompt.id]}
                    onAnswer={(answerLabel, isCustom) => setPromptAnswer(prompt.id, answerLabel, isCustom)}
                  />
                ))}
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: colors.label, fontSize: 16 }}>Öffentlich teilen</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.positive, false: colors.fill2 }}
              />
            </View>
          </View>
        )}

        {error && <Text style={{ color: colors.regretInk, fontSize: 15 }}>{error}</Text>}
      </ScrollView>

      {/* Action bar */}
      <View style={{ flexDirection: 'row', gap: 10, padding: spacing.lg, paddingTop: spacing.sm }}>
        {step > 1 && <Button title="Zurück" variant="soft" onPress={() => setStep((s) => s - 1)} style={{ flex: 0, paddingHorizontal: 28 }} />}
        {step < TOTAL_STEPS ? (
          <Button
            title="Weiter"
            onPress={() => {
              void Haptics.selectionAsync();
              setStep((s) => s + 1);
            }}
            disabled={!canNext}
            style={{ flex: 1 }}
          />
        ) : (
          <Button title={user ? 'Abschicken' : 'Anmelden & speichern'} onPress={submit} loading={submitting} style={{ flex: 1 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

function PromptAnswerCard({
  prompt,
  selected,
  onAnswer,
}: {
  prompt: ProductPromptDto;
  selected?: { answerLabel: string; isCustom: boolean };
  onAnswer: (answerLabel: string, isCustom?: boolean) => void;
}) {
  const { colors, radius } = useTheme();
  const [custom, setCustom] = useState(selected?.isCustom ? selected.answerLabel : '');
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
      <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700', lineHeight: 20 }}>{prompt.questionText}</Text>
      {prompt.quickAnswers.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {prompt.quickAnswers.map((answer) => {
            const active = selected?.answerLabel === answer && !selected.isCustom;
            return (
              <Pressable
                key={answer}
                onPress={() => onAnswer(active ? '' : answer, false)}
                style={{
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.accent : colors.fill2,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: active ? '#fff' : colors.label, fontSize: 13, fontWeight: '700' }}>{answer}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <TextInput
        value={custom}
        onChangeText={(value) => {
          setCustom(value);
          onAnswer(value, true);
        }}
        placeholder={prompt.quickAnswers.length > 0 ? 'Andere Antwort (optional)' : 'Deine Antwort'}
        placeholderTextColor={colors.faint}
        style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.label }}
      />
    </View>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.mutedForeground, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
      {text}
    </Text>
  );
}
