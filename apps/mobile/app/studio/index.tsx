import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProfessionalProfileDto, ShowcaseSummaryDto } from '@wudly/shared';
import { PROFESSIONAL_PROFILE_TYPE_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { DisclosureBadge } from '@/components/showcase/DisclosureBadge';
import { Button, Card, Center, Muted } from '@/components/ui';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'Live',
  ARCHIVED: 'Archiviert',
};

export default function StudioScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfileDto | null>(null);
  const [showcases, setShowcases] = useState<ShowcaseSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.showcase.myProfile().catch(() => null),
        api.showcase.mine().catch(() => []),
      ]);
      setProfile(p);
      setShowcases(s);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
          <Ionicons name="sparkles-outline" size={56} color={colors.accent} />
          <Text style={{ color: colors.label, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>Creator-Studio</Text>
          <Muted style={{ textAlign: 'center' }}>Melde dich an, um Profi-Profile und Showcases zu verwalten.</Muted>
          <Button title="Anmelden" onPress={() => router.push('/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View>
          <Text style={{ color: colors.label, fontSize: 28, fontWeight: '800' }}>Creator-Studio</Text>
          <Muted style={{ marginTop: 4 }}>Creator-, Tester- und Markeninhalte klar getrennt vom neutralen Wudly Signal.</Muted>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : !profile ? (
          <Card style={{ gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={26} color={colors.accentInk} />
            </View>
            <Text style={{ color: colors.label, fontSize: 21, fontWeight: '800' }}>Profi-Profil anlegen</Text>
            <Muted>Erstelle dein oeffentliches Profil, bevor du eigene Produkt-Showcases veroeffentlichst.</Muted>
            <Button title="Profil anlegen" onPress={() => router.push('/studio/profil' as any)} />
          </Card>
        ) : (
          <>
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ width: 60, height: 60, borderRadius: radius.lg, backgroundColor: colors.fill2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {profile.logoUrl ? (
                    <Image source={{ uri: profile.logoUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 25, fontWeight: '800' }}>{profile.displayName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ color: colors.label, fontSize: 20, fontWeight: '800', flex: 1 }}>{profile.displayName}</Text>
                    {profile.verificationStatus === 'VERIFIED' && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </View>
                  <Text style={{ color: colors.accentInk, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                    {PROFESSIONAL_PROFILE_TYPE_LABEL[profile.type] ?? profile.type}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Profil bearbeiten" variant="soft" onPress={() => router.push('/studio/profil' as any)} style={{ flex: 1 }} />
                <Button title="Oeffentlich" variant="soft" onPress={() => router.push({ pathname: '/creator/[slug]', params: { slug: profile.slug } })} style={{ flex: 1 }} />
              </View>
            </Card>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: colors.label, fontSize: 18, fontWeight: '800' }}>Meine Showcases</Text>
              <Button title="Neu" onPress={() => router.push('/studio/neu' as any)} style={{ paddingHorizontal: 16 }} />
            </View>

            {showcases.length === 0 ? (
              <Card>
                <Muted style={{ textAlign: 'center' }}>Noch keine Showcases. Erstelle deine erste Produktseite.</Muted>
              </Card>
            ) : (
              showcases.map((showcase) => (
                <Pressable key={showcase.id} onPress={() => router.push({ pathname: '/studio/showcases/[id]' as any, params: { id: showcase.id } })}>
                  <Card style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <StatusPill status={showcase.status} />
                      <DisclosureBadge type={showcase.disclosureType} />
                    </View>
                    <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>{showcase.title}</Text>
                    <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13 }}>
                      {(showcase.product?.canonicalName ?? 'Produkt') + ' - ' + showcase.blockCount + ' Bloecke'}
                    </Text>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: string }) {
  const { colors, radius } = useTheme();
  const live = status === 'PUBLISHED';
  return (
    <View style={{ backgroundColor: live ? colors.positiveSoft : colors.fill2, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9 }}>
      <Text style={{ color: live ? colors.positiveInk : colors.mutedForeground, fontSize: 11, fontWeight: '800' }}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}
