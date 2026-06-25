import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MyProductsDto } from '@wudly/shared';
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
  const [loadingMine, setLoadingMine] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMine = useCallback(async () => {
    if (!user) return;
    setLoadingMine(true);
    try {
      const res = await api.products.mine();
      setMine(res);
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

        <Button title="Abmelden" variant="soft" onPress={logout} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
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
