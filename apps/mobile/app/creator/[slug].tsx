import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProfileDetailDto } from '@wudly/shared';
import { PROFESSIONAL_PROFILE_TYPE_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { DisclosureBadge } from '@/components/showcase/DisclosureBadge';
import { Card, Center, Muted } from '@/components/ui';

export default function CreatorProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await api.showcase.profile(slug);
      setProfile(res);
      navigation.setOptions({ title: res.displayName });
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Profil konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [slug, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    );
  }
  if (error || !profile) {
    return (
      <Center>
        <Muted style={{ color: colors.regretInk }}>{error ?? 'Nicht gefunden.'}</Muted>
      </Center>
    );
  }

  const isVerified = profile.verificationStatus === 'VERIFIED';
  const socials = Object.entries(profile.socialLinks ?? {});

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}>
        {/* Header */}
        <Card>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.fill2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {profile.logoUrl ? (
                <Image source={{ uri: profile.logoUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 28, fontWeight: '800' }}>{profile.displayName.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: colors.label, fontSize: 22, fontWeight: '800', flexShrink: 1 }}>{profile.displayName}</Text>
                {isVerified && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
              </View>
              <Text style={{ color: colors.accentInk, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                {PROFESSIONAL_PROFILE_TYPE_LABEL[profile.type] ?? profile.type}
              </Text>
            </View>
          </View>

          {profile.bio && <Text style={{ color: colors.label, fontSize: 15, marginTop: 12, lineHeight: 21 }}>{profile.bio}</Text>}

          {profile.paidPartnerships && (
            <View style={{ marginTop: 12 }}>
              <DisclosureBadge type="PAID_PARTNERSHIP" />
            </View>
          )}

          {(profile.websiteUrl || socials.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {profile.websiteUrl && <SocialChip label="Website" url={profile.websiteUrl} icon="globe-outline" />}
              {socials.map(([k, url]) => (
                <SocialChip key={k} label={k} url={url} icon="link-outline" />
              ))}
            </View>
          )}
        </Card>

        {/* Showcases */}
        <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 }}>
          Showcases · {profile.showcaseCount}
        </Text>
        {profile.showcases.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>Noch keine veröffentlichten Showcases.</Muted>
          </Card>
        ) : (
          profile.showcases.map((s) => (
            <Pressable key={s.id} onPress={() => router.push({ pathname: '/showcases/[id]', params: { id: s.id } })}>
              <Card style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: colors.label, fontSize: 16, fontWeight: '700', flex: 1 }}>{s.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                </View>
                {s.subtitle && <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{s.subtitle}</Text>}
                {s.product && <Text style={{ color: colors.faint, fontSize: 12 }}>{s.product.canonicalName}</Text>}
                <View style={{ marginTop: 4 }}>
                  <DisclosureBadge type={s.disclosureType} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SocialChip({ label, url, icon }: { label: string; url: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={() => Linking.openURL(url.startsWith('http') ? url : `https://${url}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.fill2, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}
    >
      <Ionicons name={icon} size={14} color={colors.label} />
      <Text style={{ color: colors.label, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{label}</Text>
    </Pressable>
  );
}
