import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { ProductFindResultDto, ProductSummaryDto, ExternalProductSuggestionDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { ProductCard } from '@/components/ProductCard';
import { Muted } from '@/components/ui';

export default function CheckScreen() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [find, setFind] = useState<ProductFindResultDto | null>(null);
  const [recent, setRecent] = useState<ProductSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [deep, setDeep] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const list = await api.products.newest(10);
      setRecent(list);
    } catch {
      /* silent — recent list is a nice-to-have */
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const runSearch = useCallback(async (q: string, deepSearch: boolean) => {
    if (q.trim().length < 2) {
      setFind(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.products.find(q.trim(), deepSearch);
      setFind(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Suche fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onChange = (text: string) => {
    setQuery(text);
    setDeep(false);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(text, false), 320);
  };

  const onDeepSearch = () => {
    setDeep(true);
    void Haptics.selectionAsync();
    void runSearch(query, true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecent();
    if (query.trim().length >= 2) await runSearch(query, deep);
    setRefreshing(false);
  };

  const showResults = query.trim().length >= 2;
  const catalog = find?.catalog ?? [];
  const market = find?.market ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800', marginBottom: 4 }}>
          Würdest du es wieder kaufen?
        </Text>
        <Muted style={{ marginBottom: spacing.md }}>Produkt suchen, scannen oder hinzufügen.</Muted>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surface,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
          }}
        >
          <Ionicons name="search" size={20} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={onChange}
            placeholder="z.B. Dyson V15, AirPods Pro…"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query, deep)}
            style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: colors.label }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setFind(null); }} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.faint} />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/scan')}
            hitSlop={8}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="barcode-outline" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={showResults ? catalog : recent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard product={item} />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View>
            {loading && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            )}
            {error && <Muted style={{ color: colors.regretInk, marginBottom: 12 }}>{error}</Muted>}
            {!showResults && recent.length > 0 && (
              <SectionLabel text="Frisch im Katalog" />
            )}
            {showResults && catalog.length > 0 && <SectionLabel text="Im Katalog gefunden" />}
          </View>
        }
        ListFooterComponent={
          <MarketResults
            visible={showResults && !loading}
            catalogEmpty={catalog.length === 0}
            market={market}
            hasStrongMatch={find?.hasStrongMatch ?? false}
            deep={deep}
            onDeepSearch={onDeepSearch}
            query={query}
          />
        }
        ListEmptyComponent={
          !loading && showResults && catalog.length === 0 && market.length === 0 ? (
            <Muted style={{ textAlign: 'center', marginTop: 24 }}>Noch nichts gefunden.</Muted>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.faint,
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
      }}
    >
      {text}
    </Text>
  );
}

function MarketResults({
  visible,
  catalogEmpty,
  market,
  hasStrongMatch,
  deep,
  onDeepSearch,
  query,
}: {
  visible: boolean;
  catalogEmpty: boolean;
  market: ExternalProductSuggestionDto[];
  hasStrongMatch: boolean;
  deep: boolean;
  onDeepSearch: () => void;
  query: string;
}) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  if (!visible) return null;

  const createFromSuggestion = async (s: ExternalProductSuggestionDto) => {
    setCreating(s.title);
    try {
      const res = await api.products.research(s.ean ? `${s.title} ${s.ean}` : s.title);
      if (res.product) router.push(`/product/${res.product.id}`);
    } catch {
      /* surfaced via empty nav; keep simple */
    } finally {
      setCreating(null);
    }
  };

  return (
    <View style={{ marginTop: market.length ? 16 : 8 }}>
      {market.length > 0 && (
        <>
          <SectionLabel text="Vorschläge vom Markt" />
          {market.map((s) => (
            <Pressable
              key={`${s.source}-${s.title}`}
              onPress={() => createFromSuggestion(s)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                marginBottom: 10,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
                backgroundColor: colors.surfaceSoft,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceMuted,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.image ? (
                  <Image source={{ uri: s.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <Ionicons name="add" size={22} color={colors.accent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ color: colors.label, fontWeight: '700', fontSize: 15 }}>
                  {s.title}
                </Text>
                <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2 }}>
                  {s.brand ? `${s.brand} · ` : ''}Hinzufügen & prüfen
                </Text>
              </View>
              {creating === s.title ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.faint} />
              )}
            </Pressable>
          ))}
        </>
      )}

      {!hasStrongMatch && !deep && (
        <Pressable
          onPress={onDeepSearch}
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: radius.lg,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="sparkles-outline" size={18} color={colors.accentInk} />
          <Text style={{ color: colors.accentInk, fontWeight: '700' }}>
            Tiefer im Markt suchen „{query.trim()}“
          </Text>
        </Pressable>
      )}
    </View>
  );
}
