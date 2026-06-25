import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ProductSummaryDto } from '@wudly/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { dataConfidenceLabel, rebuyVerdict } from '@/theme/verdict';

interface Props {
  product: ProductSummaryDto;
  rank?: number;
}

/** A product as a compact, tappable row: thumb · name · confidence ····· score. */
export function ProductCard({ product, rank }: Props) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const verdict = rebuyVerdict(product.rebuyScore, colors);
  const scoreText = product.rebuyScore === null ? '–' : `${product.rebuyScore}%`;

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {rank !== undefined && (
        <Text style={{ width: 22, textAlign: 'center', fontWeight: '800', color: colors.faint, fontSize: 16 }}>
          {rank}
        </Text>
      )}
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="cube-outline" size={24} color={colors.faint} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ color: colors.label, fontSize: 16, fontWeight: '700', lineHeight: 20 }}>
          {product.canonicalName}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: colors.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}
        >
          {product.brand ? `${product.brand} · ` : ''}
          {dataConfidenceLabel(product.experienceCount)}
        </Text>
      </View>

      <Text style={{ fontSize: 26, fontWeight: '800', color: verdict.color }}>{scoreText}</Text>
    </Pressable>
  );
}
