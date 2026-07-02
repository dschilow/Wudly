import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { ApiError } from '@/lib/api-client';
import { Button, Muted } from '@/components/ui';

export default function LoginScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || password.length < (mode === 'register' ? 8 : 1)) {
      setError(mode === 'register' ? 'E-Mail und Passwort (mind. 8 Zeichen) erforderlich.' : 'E-Mail und Passwort erforderlich.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.label,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800' }}>
          {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
        </Text>
        <Muted style={{ marginBottom: spacing.sm }}>
          {mode === 'login'
            ? 'Melde dich an, um Produkte zu bewerten.'
            : 'Schon ab der ersten Bewertung zählst du dazu.'}
        </Muted>

        {mode === 'register' && (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Anzeigename (optional)"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            style={inputStyle}
          />
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-Mail"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Passwort"
          placeholderTextColor={colors.faint}
          secureTextEntry
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          style={inputStyle}
        />

        {mode === 'login' && (
          <Button title="Passwort vergessen?" variant="ghost" onPress={() => router.push('/passwort-vergessen' as any)} />
        )}

        {error && <Text style={{ color: colors.regretInk, fontSize: 14 }}>{error}</Text>}

        <Button
          title={mode === 'login' ? 'Anmelden' : 'Registrieren'}
          onPress={submit}
          loading={busy}
          style={{ marginTop: spacing.sm }}
        />

        <Button
          title={mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
          variant="ghost"
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

