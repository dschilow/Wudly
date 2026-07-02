import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProductDetailDto, ProductSummaryDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';
import { ScoreRing } from '@/components/ScoreRing';
import { Card, Muted } from '@/components/ui';

const MAX_COMPARE = 3;

/** Side-by-side comparison of up to 3 products: verdict, owner data, top aspects. */
export default function CompareScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string }>();

  const [products, setProducts] = useState<ProductDetailDto[]>([]);
  const [adding, setAdding] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addProduct = useCallback(
    async (id: string) => {
      if (products.some((p) => p.id === id) || products.length >= MAX_COMPARE) return;
      try {
        const detail = await api.products.get(id);
        setProducts((prev) => [...prev, detail]);
        setAdding(false);
        setQuery('');
        setResults([]);
      } catch {
        /* ignore */
      }
    },
    [products],
  );

  const onSearch = (text: string) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await api.products.search(text.trim(), 8);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  useEffect(() => {
    const raw = params.ids;
    const ids = typeof raw === 'string' ? raw.split(',').map((x) => x.trim()).filter(Boolean).slice(0, MAX_COMPARE) : [];
    if (ids.length === 0) return;
    let active = true;
    Promise.all(ids.map((id) => api.products.get(id).catch(() => null))).then((items) => {
      if (!active) return;
      const loaded = items.filter((item): item is ProductDetailDto => Boolean(item));
      const unique = loaded.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
      setProducts(unique);
      setAdding(unique.length < 2);
    });
    return () => {
      active = false;
    };
  }, [params.ids]);

  const remove = (id: string) => setProducts((prev) => prev.filter((p) => p.id !== id));

  // Best value per metric for highlighting.
  const bestRebuy = Math.max(...products.map((p) => p.rebuyScore ?? -1));

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}>
        {/* Selected products row */}
        {products.length > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {products.map((p) => {
              const isBest = p.rebuyScore !== null && p.rebuyScore === bestRebuy && products.length > 1;
              return (
                <Card key={p.id} style={{ flex: 1, alignItems: 'center', gap: 8, borderColor: isBest ? colors.accent : colors.border, borderWidth: isBest ? 2 : 1 }}>
                  <Pressable onPress={() => remove(p.id)} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.faint} />
                  </Pressable>
                  <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                      {p.imageUrl ? (
                        <Image source={{ uri: p.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <Ionicons name="cube-outline" size={22} color={colors.faint} />
                      )}
                    </View>
                    <Text numberOfLines={2} style={{ color: colors.label, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                      {p.canonicalName}
                    </Text>
                  </Pressable>
                  <ScoreRing score={p.rebuyScore} size={56} />
                  {isBest && <Text style={{ color: colors.accentInk, fontSize: 11, fontWeight: '800' }}>BESTE WERTUNG</Text>}
                </Card>
              );
            })}
            {products.length < MAX_COMPARE && (
              <Pressable
                onPress={() => setAdding(true)}
                style={{ width: 64, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="add" size={28} color={colors.accent} />
              </Pressable>
            )}
          </View>
        )}

        {/* Comparison rows */}
        {products.length >= 2 && (
          <Card style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
            <CompareRow label="Würde wieder kaufen" products={products} value={(p) => (p.rebuyScore !== null ? `${p.rebuyScore}%` : '–')} />
            <CompareRow label="Reue-Quote" products={products} value={(p) => (p.regretScore !== null ? `${p.regretScore}%` : '–')} />
            <CompareRow label="Besitzer" products={products} value={(p) => String(p.ownerCount)} />
            <CompareRow label="Bewertungen" products={products} value={(p) => String(p.experienceCount)} />
            <CompareRow label="Netz-Konsens" products={products} value={(p) => (p.externalAvgPercent !== null ? `${p.externalAvgPercent}%` : '–')} last />
          </Card>
        )}

        {/* Top aspects per product */}
        {products.length >= 2 &&
          products.map((p) => {
            const pos = p.insights.topPositiveAspects.slice(0, 3);
            const neg = p.insights.topNegativeAspects.slice(0, 3);
            if (pos.length === 0 && neg.length === 0) return null;
            return (
              <Card key={`asp-${p.id}`}>
                <Text style={{ color: colors.label, fontSize: 15, fontWeight: '800', marginBottom: 8 }} numberOfLines={1}>
                  {p.canonicalName}
                </Text>
                {pos.map((a) => (
                  <View key={`p-${a.key}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
                    <Ionicons name="add-circle" size={15} color={colors.positiveInk} />
                    <Text style={{ color: colors.label, fontSize: 14, flex: 1 }}>{a.label}</Text>
                    <Text style={{ color: colors.faint, fontSize: 13 }}>{a.count}×</Text>
                  </View>
                ))}
                {neg.map((a) => (
                  <View key={`n-${a.key}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
                    <Ionicons name="remove-circle" size={15} color={colors.regretInk} />
                    <Text style={{ color: colors.label, fontSize: 14, flex: 1 }}>{a.label}</Text>
                    <Text style={{ color: colors.faint, fontSize: 13 }}>{a.count}×</Text>
                  </View>
                ))}
              </Card>
            );
          })}

        {/* Search / add panel */}
        {(adding || products.length === 0) && (
          <View style={{ gap: spacing.md }}>
            {products.length === 0 && (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                <Ionicons name="git-compare-outline" size={40} color={colors.accent} />
                <Text style={{ color: colors.label, fontSize: 18, fontWeight: '800' }}>Produkte vergleichen</Text>
                <Muted style={{ textAlign: 'center' }}>Füge bis zu drei Produkte hinzu und sieh die Wertungen nebeneinander.</Muted>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
              <Ionicons name="search" size={18} color={colors.faint} />
              <TextInput
                value={query}
                onChangeText={onSearch}
                placeholder="Produkt suchen…"
                placeholderTextColor={colors.faint}
                autoFocus={products.length > 0}
                style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: colors.label }}
              />
              {searching && <ActivityIndicator color={colors.accent} />}
            </View>
            <View style={{ gap: 8 }}>
              {results.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => addProduct(r.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {r.imageUrl ? (
                      <Image source={{ uri: r.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <Ionicons name="cube-outline" size={18} color={colors.faint} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.label, fontSize: 15, fontWeight: '600' }}>{r.canonicalName}</Text>
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompareRow({
  label,
  products,
  value,
  last,
}: {
  label: string;
  products: ProductDetailDto[];
  value: (p: ProductDetailDto) => string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, paddingVertical: 10, paddingHorizontal: 14 }}>
      <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row' }}>
        {products.map((p) => (
          <Text key={p.id} style={{ flex: 1, color: colors.label, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
            {value(p)}
          </Text>
        ))}
      </View>
    </View>
  );
}
