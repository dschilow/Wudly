import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfessionalProfileType, PROFESSIONAL_PROFILE_TYPE_LABEL, type ProfessionalProfileDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Center, Muted } from '@/components/ui';

const PROFILE_TYPES = Object.values(ProfessionalProfileType);

export default function StudioProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [existing, setExisting] = useState<ProfessionalProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<ProfessionalProfileType>(ProfessionalProfileType.CREATOR);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [paidPartnerships, setPaidPartnerships] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const profile = await api.showcase.myProfile();
      if (profile) {
        setExisting(profile);
        setType(profile.type);
        setDisplayName(profile.displayName);
        setBio(profile.bio ?? '');
        setWebsiteUrl(profile.websiteUrl ?? '');
        setLogoUrl(profile.logoUrl ?? '');
        setInstagram(profile.socialLinks?.instagram ?? '');
        setYoutube(profile.socialLinks?.youtube ?? '');
        setTiktok(profile.socialLinks?.tiktok ?? '');
        setPaidPartnerships(profile.paidPartnerships);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const socialLinks = useMemo(() => {
    const links: Record<string, string> = {};
    if (instagram.trim()) links.instagram = instagram.trim();
    if (youtube.trim()) links.youtube = youtube.trim();
    if (tiktok.trim()) links.tiktok = tiktok.trim();
    return links;
  }, [instagram, youtube, tiktok]);

  const save = async () => {
    if (displayName.trim().length < 2 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        socialLinks,
        paidPartnerships,
      };
      if (existing) await api.showcase.updateProfile(existing.id, payload);
      else await api.showcase.createProfile({ type, ...payload });
      router.replace('/studio' as any);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    if (!existing || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const updated = await api.showcase.requestVerification(existing.id);
      setExisting(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Anfrage fehlgeschlagen.');
    } finally {
      setVerifying(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    );
  }

  if (!user) {
    return (
      <Center>
        <Button title="Anmelden" onPress={() => router.push('/login')} />
      </Center>
    );
  }

  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.label,
    fontSize: 16,
  } as const;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={{ color: colors.label, fontSize: 27, fontWeight: '800' }}>{existing ? 'Profil bearbeiten' : 'Profi-Profil anlegen'}</Text>
            <Muted style={{ marginTop: 4 }}>So erscheinst du oeffentlich auf deiner Creator-Seite.</Muted>
          </View>

          {!existing ? (
            <View style={{ gap: 8 }}>
              <Label text="Profiltyp" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PROFILE_TYPES.map((value) => {
                  const active = type === value;
                  return (
                    <Pressable key={value} onPress={() => setType(value)} style={{ backgroundColor: active ? colors.accentSoft : colors.surface, borderWidth: 1, borderColor: active ? colors.accent : colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 }}>
                      <Text style={{ color: active ? colors.accentInk : colors.label, fontWeight: '800' }}>{PROFESSIONAL_PROFILE_TYPE_LABEL[value]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
              <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>Typ: {PROFESSIONAL_PROFILE_TYPE_LABEL[existing.type]}</Text>
              {existing.verificationStatus === 'VERIFIED' ? (
                <Text style={{ color: colors.positiveInk, fontWeight: '800' }}>Verifiziert</Text>
              ) : (
                <Pressable onPress={requestVerification} disabled={verifying}>
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>{verifying ? 'Sendet...' : 'Verifizierung anfragen'}</Text>
                </Pressable>
              )}
            </View>
          )}

          <Field label="Anzeigename"><TextInput value={displayName} onChangeText={setDisplayName} placeholder="z. B. Lena testet" placeholderTextColor={colors.faint} style={inputStyle} /></Field>
          <Field label="Ueber dich"><TextInput value={bio} onChangeText={setBio} placeholder="Was testest du / wofuer steht deine Marke?" placeholderTextColor={colors.faint} multiline style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]} /></Field>
          <Field label="Website"><TextInput value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://..." placeholderTextColor={colors.faint} autoCapitalize="none" keyboardType="url" style={inputStyle} /></Field>
          <Field label="Logo / Avatar URL"><TextInput value={logoUrl} onChangeText={setLogoUrl} placeholder="https://.../logo.png" placeholderTextColor={colors.faint} autoCapitalize="none" keyboardType="url" style={inputStyle} /></Field>

          <View style={{ gap: 10 }}>
            <Label text="Social Links" />
            <TextInput value={instagram} onChangeText={setInstagram} placeholder="Instagram-URL" placeholderTextColor={colors.faint} autoCapitalize="none" keyboardType="url" style={inputStyle} />
            <TextInput value={youtube} onChangeText={setYoutube} placeholder="YouTube-URL" placeholderTextColor={colors.faint} autoCapitalize="none" keyboardType="url" style={inputStyle} />
            <TextInput value={tiktok} onChangeText={setTiktok} placeholder="TikTok-URL" placeholderTextColor={colors.faint} autoCapitalize="none" keyboardType="url" style={inputStyle} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.label, fontSize: 15, fontWeight: '800' }}>Bezahlte Kooperationen</Text>
              <Muted style={{ marginTop: 2 }}>Wird auf deinem Profil sichtbar angezeigt.</Muted>
            </View>
            <Switch value={paidPartnerships} onValueChange={setPaidPartnerships} trackColor={{ true: colors.accent, false: colors.fill2 }} />
          </View>

          {error && <Text style={{ color: colors.regretInk }}>{error}</Text>}
          <Button title={existing ? 'Aenderungen speichern' : 'Profil anlegen'} onPress={save} loading={saving} disabled={displayName.trim().length < 2} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Label text={label} />
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 }}>{text}</Text>;
}
