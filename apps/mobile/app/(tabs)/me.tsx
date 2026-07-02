import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WouldBuyAgain, type ExperienceDto, type MyProductsDto, type ProfileSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { ProductCard } from '@/components/ProductCard';
import { Button, Card, Muted } from '@/components/ui';

export default function MeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [mine, setMine] = useState<MyProductsDto | null>(null);
  const [summary, setSummary] = useState<ProfileSummaryDto | null>(null);
  const [experiences, setExperiences] = useState<ExperienceDto[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMine = useCallback(async () => {
    if (!user) return;
    setLoadingMine(true);
    try {
      const [res, profile, ownExperiences] = await Promise.all([
        api.products.mine(),
        api.profile.summary().catch(() => null),
        api.experiences.mine().catch(() => []),
      ]);
      setMine(res);
      setSummary(profile);
      setExperiences(ownExperiences);
    } catch {
      setMine(null);
    } finally {
      setLoadingMine(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadMine();
    }, [loadMine]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMine();
    setRefreshing(false);
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Logged-out state
  if (!user) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Ionicons name="person-circle-outline" size={64} color={colors.accent} />
            <Text style={{ color: colors.label, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
              Deine Erfahrungen zählen
            </Text>
            <Muted style={{ textAlign: 'center' }}>
              Melde dich an, um Produkte zu bewerten, eigene Käufe zu verwalten und Fragen zu beantworten.
            </Muted>
          </View>
          <Button title="Anmelden / Registrieren" onPress={() => router.push('/login')} />
        </View>
      </SafeAreaView>
    );
  }

  // Logged-in state
  const owned = mine?.owned ?? [];
  const created = mine?.created ?? [];
  const rebuyRate =
    experiences.length === 0
      ? null
      : Math.round((experiences.filter((experience) => experience.wouldBuyAgain === WouldBuyAgain.YES).length / experiences.length) * 100);

  const shareProfile = async () => {
    await Share.share({
      title: 'Wudly Kaufprofil',
      message:
        (user.displayName ?? 'Mein Wudly-Profil') +
        ': ' +
        (rebuyRate === null ? 'Noch keine Rebuy-Quote' : rebuyRate + '% meiner Produkte wuerde ich wieder kaufen') +
        '. https://wudly.app',
    }).catch(() => {});
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.accentInk, fontSize: 22, fontWeight: '800' }}>
              {(user.displayName ?? user.email)[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.label, fontSize: 17, fontWeight: '800' }}>
              {user.displayName ?? 'Wudly-Nutzer'}
            </Text>
            <Muted>{user.email}</Muted>
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <View>
              <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Rebuy-Profil
              </Text>
              <Text style={{ color: colors.label, fontSize: 42, lineHeight: 46, fontWeight: '800', marginTop: 4 }}>
                {rebuyRate === null ? '-' : rebuyRate + '%'}
              </Text>
            </View>
            <View style={{ backgroundColor: rebuyRate === null ? colors.fill2 : rebuyRate >= 70 ? colors.positiveSoft : colors.unsureSoft, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
              <Text style={{ color: rebuyRate === null ? colors.mutedForeground : rebuyRate >= 70 ? colors.positiveInk : colors.unsureInk, fontSize: 12, fontWeight: '800' }}>
                {rebuyRate === null ? 'Noch offen' : rebuyRate >= 70 ? 'Gute Kaeufe' : 'Gemischt'}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>
            {rebuyRate === null ? 'Teile deine erste Erfahrung, dann entsteht dein Kaufprofil.' : 'deiner Produkte wuerdest du wieder kaufen.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ProfileMetric label="Produkte" value={summary?.productCount ?? owned.length + created.length} />
            <ProfileMetric label="Erfahrungen" value={summary?.experienceCount ?? experiences.length} />
            <ProfileMetric label="Antworten" value={summary?.answerCount ?? 0} />
            <ProfileMetric label="Geholfen" value={summary?.helpfulReceived ?? 0} />
          </View>
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <ProfileLinkRow icon="chatbubble-ellipses-outline" label="Meine Antworten" subtitle="Fragen, die du beantworten kannst" onPress={() => router.push('/inbox')} />
          <ProfileLinkRow icon="sparkles-outline" label="Creator-Studio" subtitle="Profile und Showcases verwalten" onPress={() => router.push('/studio' as any)} />
          <ProfileLinkRow icon="share-social-outline" label="Profilkarte teilen" subtitle="Dein Kaufprofil als Karte" onPress={shareProfile} />
          {user.role === 'ADMIN' && (
            <ProfileLinkRow icon="shield-checkmark-outline" label="Admin-Bereich" subtitle="Produkte, Bilder, Bewertungen" onPress={() => router.push('/admin' as any)} />
          )}
        </Card>

        {loadingMine && (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {owned.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel text={`Meine Produkte (${owned.length})`} />
            {owned.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </View>
        )}

        {created.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel text={`Von mir hinzugefügt (${created.length})`} />
            {created.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </View>
        )}

        {!loadingMine && owned.length === 0 && created.length === 0 && (
          <Muted style={{ textAlign: 'center', marginTop: 12 }}>
            Noch keine Produkte. Scanne oder suche etwas, das du besitzt.
          </Muted>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: spacing.md }}>
          <Pressable onPress={() => Linking.openURL('https://wudly.app/impressum')}><Muted>Impressum</Muted></Pressable>
          <Pressable onPress={() => Linking.openURL('https://wudly.app/datenschutz')}><Muted>Datenschutz</Muted></Pressable>
          <Pressable onPress={() => Linking.openURL('https://wudly.app/agb')}><Muted>AGB</Muted></Pressable>
        </View>

        <Button title="Abmelden" variant="soft" onPress={logout} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileMetric({ label, value }: { label: string; value: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.fill2, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ color: colors.label, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function ProfileLinkRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.label, fontSize: 15, fontWeight: '800' }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>
      {text}
    </Text>
  );
}
