import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CategoryOverviewDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { ProductCard } from '@/components/ProductCard';
import { Card, Center, Muted } from '@/components/ui';

/** Category landing: average rebuy, top picks, flops, blind spot. */
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation();

  const [data, setData] = useState<CategoryOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await api.rankings.categoryOverview(slug);
      setData(res);
      navigation.setOptions({ title: res.category.name });
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Kategorie konnte nicht geladen werden.');
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
  if (error || !data) {
    return (
      <Center>
        <Muted style={{ color: colors.regretInk }}>{error ?? 'Nicht gefunden.'}</Muted>
      </Center>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }}>
        {/* Summary */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Stat label="Ø Wiederkauf" value={data.averageRebuyScore !== null ? `${data.averageRebuyScore}%` : '–'} />
          <Stat label="Produkte" value={String(data.productCount)} />
          <Stat label="Wudly-Siegel" value={String(data.sealCount)} />
        </View>

        {data.blindSpot && (
          <Card style={{ backgroundColor: colors.unsureSoft, borderColor: 'transparent', flexDirection: 'row', gap: 10 }}>
            <Ionicons name="bulb-outline" size={20} color={colors.unsureInk} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.unsureInk, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                Blinder Fleck
              </Text>
              <Text style={{ color: colors.unsureInk, fontSize: 14, lineHeight: 20 }}>{data.blindSpot}</Text>
            </View>
          </Card>
        )}

        {data.top.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel text="Top-Empfehlungen" />
            {data.top.slice(0, 10).map((p, i) => (
              <ProductCard key={p.id} product={p} rank={i + 1} />
            ))}
          </View>
        )}

        {data.flops.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel text="Häufige Fehlkäufe" />
            {data.flops.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center' }}>
      <Text style={{ color: colors.label, fontSize: 19, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>{text}</Text>
  );
}
