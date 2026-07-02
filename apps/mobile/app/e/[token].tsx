import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { PublicInviteDto, WouldBuyAgain } from '@wudly/shared';
import { WOULD_BUY_AGAIN_OPTIONS } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Center, Muted } from '@/components/ui';

const choiceTone: Record<string, 'positive' | 'negative' | 'neutral' | 'warning'> = {
  positive: 'positive',
  negative: 'negative',
  warning: 'warning',
  neutral: 'neutral',
};

export default function InviteRatingScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user, login, register } = useAuth();

  const [invite, setInvite] = useState<PublicInviteDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<WouldBuyAgain | null>(null);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.invites.publicInvite(token);
      setInvite(data);
    } catch {
      setInvite(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!token || !choice) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.invites.rate(token, {
        wouldBuyAgain: choice,
        guestName: name.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      if (user) {
        await api.invites.claim(token).catch(() => {});
        setClaimed(true);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Bewertung konnte nicht gespeichert werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuth = async () => {
    if (!token) return;
    if (!email.trim() || password.length < 8) {
      setAuthError('E-Mail und ein Passwort mit mindestens 8 Zeichen.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === 'register') {
        await register({ email: email.trim(), password, displayName: name.trim() || undefined });
      } else {
        await login({ email: email.trim(), password });
      }
      await api.invites.claim(token).catch(() => {});
      setClaimed(true);
    } catch (err) {
      setAuthError(err instanceof ApiError ? err.displayMessage : 'Hat nicht geklappt. Bitte pruefen.');
    } finally {
      setAuthBusy(false);
    }
  };

  if (loading) {
    return (
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    );
  }

  if (!invite || !invite.active) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <Ionicons name="file-tray-outline" size={56} color={colors.faint} />
          <Text style={{ color: colors.label, fontSize: 23, fontWeight: '800', textAlign: 'center' }}>Einladung nicht mehr gueltig</Text>
          <Muted style={{ textAlign: 'center' }}>Dieser Link ist abgelaufen oder wurde bereits genutzt.</Muted>
          <Button title="Wudly entdecken" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    const counted = Boolean(user) || claimed;
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ minHeight: '100%', justifyContent: 'center', padding: spacing.xl, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={44} color="#fff" />
            </View>
            <Text style={{ color: colors.label, fontSize: 28, fontWeight: '800', textAlign: 'center' }}>
              Danke{name.trim() ? `, ${name.trim()}` : ''}!
            </Text>
            <Muted style={{ textAlign: 'center', lineHeight: 21 }}>
              Deine Bewertung zu {invite.product.canonicalName} ist da.
            </Muted>
          </View>

          {counted ? (
            <View style={{ backgroundColor: colors.positiveSoft, borderRadius: radius.lg, padding: 16, gap: 6 }}>
              <Text style={{ color: colors.positiveInk, fontSize: 16, fontWeight: '800' }}>Volle Wertung</Text>
              <Text style={{ color: colors.positiveInk, fontSize: 14, lineHeight: 20 }}>
                Du bist als echter Besitzer dabei. Deine Stimme zaehlt zu 100 Prozent und du kannst spaeter Fragen beantworten.
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 }}>
              <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>Damit deine Stimme voll zaehlt</Text>
              <Muted>{authMode === 'register' ? 'Konto in kurzer Zeit erstellen und als echter Besitzer zaehlen.' : 'Melde dich an, um deine Bewertung voll zu werten.'}</Muted>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="E-Mail"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 13, color: colors.label, fontSize: 16 }}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={authMode === 'register' ? 'Passwort (mind. 8 Zeichen)' : 'Passwort'}
                placeholderTextColor={colors.faint}
                secureTextEntry
                style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 13, color: colors.label, fontSize: 16 }}
              />
              {authError && <Text style={{ color: colors.regretInk, fontSize: 14 }}>{authError}</Text>}
              <Button title={authMode === 'register' ? 'Konto erstellen & voll zaehlen' : 'Einloggen & voll zaehlen'} onPress={handleAuth} loading={authBusy} />
              <Button
                title={authMode === 'register' ? 'Schon ein Konto? Einloggen' : 'Neu hier? Konto erstellen'}
                variant="ghost"
                onPress={() => {
                  setAuthError(null);
                  setAuthMode((m) => (m === 'register' ? 'login' : 'register'));
                }}
              />
            </View>
          )}

          <Button title="Wudly entdecken" variant="soft" onPress={() => router.replace('/')} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 8 }}>
            {invite.inviterName && (
              <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                {invite.inviterName} fragt dich
              </Text>
            )}
            <View style={{ width: 104, height: 104, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {invite.product.imageUrl ? (
                <Image source={{ uri: invite.product.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              ) : (
                <Text style={{ color: colors.faint, fontSize: 34, fontWeight: '800' }}>{invite.product.canonicalName.slice(0, 1)}</Text>
              )}
            </View>
            <Text style={{ color: colors.label, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 27 }}>
              {invite.product.canonicalName}
            </Text>
            {invite.product.brand && <Muted>{invite.product.brand}</Muted>}
            {user && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.positiveSoft, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
                <Ionicons name="shield-checkmark" size={14} color={colors.positiveInk} />
                <Text style={{ color: colors.positiveInk, fontSize: 12, fontWeight: '700' }}>Eingeloggt. Zaehlt voll.</Text>
              </View>
            )}
          </View>

          <Text style={{ color: colors.label, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
            Wuerdest du es wieder kaufen?
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WOULD_BUY_AGAIN_OPTIONS.map((opt) => {
              const active = choice === opt.value;
              const tone = choiceTone[opt.tone ?? 'neutral'];
              const bg = active
                ? tone === 'positive'
                  ? colors.positiveSoft
                  : tone === 'negative'
                    ? colors.regretSoft
                    : tone === 'warning'
                      ? colors.unsureSoft
                      : colors.accentSoft
                : colors.surface;
              const fg = active
                ? tone === 'positive'
                  ? colors.positiveInk
                  : tone === 'negative'
                    ? colors.regretInk
                    : tone === 'warning'
                      ? colors.unsureInk
                      : colors.label
                : colors.mutedForeground;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setChoice(opt.value);
                  }}
                  style={{ flex: 1, minHeight: 92, borderRadius: radius.lg, borderWidth: 2, borderColor: active ? fg : colors.border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8 }}
                >
                  <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
                  <Text style={{ color: fg, fontSize: 14, fontWeight: '800', textAlign: 'center' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {choice && (
            <View style={{ gap: 10 }}>
              {!user && (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Dein Vorname (optional)"
                  placeholderTextColor={colors.faint}
                  maxLength={60}
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, color: colors.label, fontSize: 16 }}
                />
              )}
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Kurz: warum? (optional)"
                placeholderTextColor={colors.faint}
                multiline
                maxLength={600}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, color: colors.label, fontSize: 16, minHeight: 86, textAlignVertical: 'top' }}
              />
            </View>
          )}

          {error && <Text style={{ color: colors.regretInk, fontSize: 14 }}>{error}</Text>}
          <Button title="Bewertung abschicken" onPress={submit} loading={submitting} disabled={!choice} />
          <Muted style={{ textAlign: 'center', fontSize: 12 }}>{user ? 'Zaehlt sofort voll' : 'Keine Anmeldung noetig. Anonym moeglich.'}</Muted>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
