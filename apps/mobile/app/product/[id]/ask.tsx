import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COMMON_QUESTIONS } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Center, Muted } from '@/components/ui';

/** "Besitzer fragen" — textarea + AI-suggested starter questions. */
export default function AskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, loading: authLoading } = useAuth();

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([...COMMON_QUESTIONS]);
  const [aiSuggested, setAiSuggested] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Besitzer fragen' });
  }, [navigation]);

  const loadSuggestions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.products.questionSuggestions(id);
      if (res.questions.length > 0) {
        setSuggestions(res.questions);
        setAiSuggested(true);
      }
    } catch {
      /* curated COMMON_QUESTIONS fallback already set */
    }
  }, [id]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const submit = async () => {
    if (text.trim().length < 5) {
      setError('Deine Frage ist etwas zu kurz.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.questions.create(id!, { questionText: text.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/product/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Frage konnte nicht gesendet werden.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <Ionicons name="help-circle-outline" size={56} color={colors.accent} />
          <Text style={{ color: colors.label, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
            Frag echte Besitzer
          </Text>
          <Muted style={{ textAlign: 'center' }}>Melde dich an, um eine Frage zu stellen.</Muted>
          <Button title="Anmelden" onPress={() => router.push('/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Was möchtest du von echten Besitzern wissen?"
          placeholderTextColor={colors.faint}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            fontSize: 17,
            color: colors.label,
            minHeight: 96,
            textAlignVertical: 'top',
          }}
        />

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {aiSuggested && <Ionicons name="sparkles" size={14} color={colors.accent} />}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {aiSuggested ? 'Vorgeschlagene Fragen' : 'Häufige Fragen'}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {suggestions.slice(0, 5).map((q, i) => (
              <Pressable
                key={q}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setText(q);
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.label, fontSize: 16 }}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error && <Text style={{ color: colors.regretInk, fontSize: 15 }}>{error}</Text>}
      </ScrollView>

      <View style={{ padding: spacing.lg, paddingTop: spacing.sm }}>
        <Button title="Frage abschicken" onPress={submit} loading={submitting} />
      </View>
    </SafeAreaView>
  );
}
