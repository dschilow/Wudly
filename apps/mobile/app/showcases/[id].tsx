import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ShowcaseDetailDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { ShowcaseRenderer } from '@/components/showcase/ShowcaseRenderer';
import { Card, Center, Muted } from '@/components/ui';

export default function ShowcaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();

  const [showcase, setShowcase] = useState<ShowcaseDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.showcase.get(id);
      setShowcase(res);
      navigation.setOptions({ title: res.profile.displayName });
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Showcase konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

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
  if (error || !showcase) {
    return (
      <Center>
        <Muted style={{ color: colors.regretInk }}>{error ?? 'Nicht gefunden.'}</Muted>
      </Center>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}>
        {showcase.product && (
          <Pressable onPress={() => router.push(`/product/${showcase.productId}`)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {showcase.product.imageUrl ? (
                  <Image source={{ uri: showcase.product.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <Ionicons name="cube-outline" size={20} color={colors.faint} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>{showcase.product.canonicalName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <Ionicons name="shield-checkmark" size={13} color={colors.accent} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Neutrales Wudly-Signal auf der Produktseite</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Card>
          </Pressable>
        )}

        <ShowcaseRenderer showcase={showcase} />
      </ScrollView>
    </SafeAreaView>
  );
}
