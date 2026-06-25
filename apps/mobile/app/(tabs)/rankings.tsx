import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RankingEntryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { ProductCard } from '@/components/ProductCard';
import { Muted } from '@/components/ui';

type Tab = 'rebuy' | 'regret' | 'discussed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'rebuy', label: 'Top Käufe' },
  { key: 'regret', label: 'Fehlkäufe' },
  { key: 'discussed', label: 'Meist diskutiert' },
];

export default function RankingsScreen() {
  const { colors, spacing, radius } = useTheme();
  const [tab, setTab] = useState<Tab>('rebuy');
  const [entries, setEntries] = useState<RankingEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: Tab) => {
    setError(null);
    try {
      const fn =
        which === 'rebuy'
          ? api.rankings.topRebuy
          : which === 'regret'
            ? api.rankings.topRegret
            : api.rankings.mostDiscussed;
      const res = await fn(30);
      setEntries(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Rankings konnten nicht geladen werden.');
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load(tab).finally(() => setLoading(false));
  }, [tab, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Segmented control */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: radius.pill,
                backgroundColor: active ? colors.accent : colors.fill2,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: active ? '#fff' : colors.mutedForeground, fontWeight: '700', fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.product.id}
          renderItem={({ item }) => <ProductCard product={item.product} rank={item.rank} />}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <Muted style={{ textAlign: 'center', marginTop: 32 }}>
              {error ?? 'Noch keine Einträge.'}
            </Muted>
          }
        />
      )}
    </SafeAreaView>
  );
}
