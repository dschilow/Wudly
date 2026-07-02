import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Muted } from '@/components/ui';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!token) {
      setError('Dieser Link enthaelt keinen gueltigen Token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Die Passwoerter stimmen nicht ueberein.');
      return;
    }
    if (password.length < 8) {
      setError('Das Passwort braucht mindestens 8 Zeichen.');
      return;
    }
    setBusy(true);
    try {
      await api.auth.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Der Link ist ungueltig oder abgelaufen. Fordere einen neuen an.'
          : err instanceof ApiError
            ? err.displayMessage
            : 'Das hat leider nicht geklappt.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.unsureInk} />
          <Text style={{ color: colors.label, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>Link unvollstaendig</Text>
          <Muted style={{ textAlign: 'center' }}>Fordere einen neuen Link zum Zuruecksetzen an.</Muted>
          <Button title="Neuen Link anfordern" onPress={() => router.replace('/passwort-vergessen' as any)} />
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.positive, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>Passwort geaendert</Text>
          <Muted style={{ textAlign: 'center' }}>Du kannst dich jetzt mit deinem neuen Passwort anmelden.</Muted>
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
            <Ionicons name="lock-closed-outline" size={34} color={colors.accentInk} />
          </View>
          <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>Neues Passwort</Text>
          <Muted style={{ textAlign: 'center' }}>Waehle ein neues Passwort fuer dein Konto.</Muted>
        </View>

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Neues Passwort (min. 8 Zeichen)"
          placeholderTextColor={colors.faint}
          secureTextEntry
          textContentType="newPassword"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.label }}
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Passwort bestaetigen"
          placeholderTextColor={colors.faint}
          secureTextEntry
          textContentType="newPassword"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.label }}
        />

        {error && <Text style={{ color: colors.regretInk, fontSize: 14 }}>{error}</Text>}
        <Button title="Passwort aendern" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
