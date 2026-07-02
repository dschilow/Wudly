import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Muted } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = email.trim();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError('Bitte eine gueltige E-Mail eingeben.');
      return;
    }
    setBusy(true);
    try {
      await api.auth.requestPasswordReset({ email: value });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Das hat leider nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="mail-open-outline" size={34} color={colors.accentInk} />
          </View>
          <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            Pruefe dein Postfach
          </Text>
          <Muted style={{ textAlign: 'center', lineHeight: 21 }}>
            Falls ein Konto mit {email.trim()} existiert, haben wir dir einen Link zum Zuruecksetzen geschickt. Der Link ist 1 Stunde gueltig.
          </Muted>
          <Button title="Zur Anmeldung" onPress={() => router.replace('/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 12, marginBottom: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="key-outline" size={34} color={colors.accentInk} />
          </View>
          <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            Passwort vergessen?
          </Text>
          <Muted style={{ textAlign: 'center' }}>Gib deine E-Mail ein. Wir schicken dir einen Link zum Zuruecksetzen.</Muted>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-Mail"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.label,
          }}
        />

        {error && <Text style={{ color: colors.regretInk, fontSize: 14 }}>{error}</Text>}
        <Button title="Link zusenden" onPress={submit} loading={busy} />
        <Button title="Zurueck zur Anmeldung" variant="ghost" onPress={() => router.replace('/login')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
