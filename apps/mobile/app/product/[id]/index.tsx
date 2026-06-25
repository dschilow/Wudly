import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Linking, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type {
  ProductDetailDto,
  ProductInsightsDto,
  ExperienceDto,
  ExternalRatingDto,
  QuestionDto,
  ProductSummaryDto,
  ShowcaseSummaryDto,
} from '@wudly/shared';
import { DISCLOSURE_META } from '@wudly/shared';
import { useAuth } from '@/lib/AuthContext';
import { EXPERIENCE_MOOD_LABEL, WOULD_BUY_AGAIN_LABEL, USAGE_DURATION_LABEL } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { ScoreRing } from '@/components/ScoreRing';
import { ProductCard } from '@/components/ProductCard';
import { QuestionCard } from '@/components/QuestionCard';
import { Card, Chip, Muted, Center, Button } from '@/components/ui';
import { dataConfidenceLabel, isEarlySignal, rebuyVerdict } from '@/theme/verdict';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();

  const { user } = useAuth();
  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [insights, setInsights] = useState<ProductInsightsDto | null>(null);
  const [experiences, setExperiences] = useState<ExperienceDto[]>([]);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [similar, setSimilar] = useState<ProductSummaryDto[]>([]);
  const [showcases, setShowcases] = useState<ShowcaseSummaryDto[]>([]);
  const [owning, setOwning] = useState(false);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSecondary = useCallback(() => {
    if (!id) return;
    void api.products.experiences(id).then(setExperiences).catch(() => {});
    void api.products.questions(id).then(setQuestions).catch(() => {});
    void api.products.similar(id).then(setSimilar).catch(() => {});
    void api.showcase.forProduct(id).then(setShowcases).catch(() => {});
  }, [id]);

  const markOwned = useCallback(async () => {
    if (!id || owning || owned) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setOwning(true);
    try {
      await api.ownership.create({ productId: id });
      setOwned(true);
    } catch {
      /* already owned or transient — treat as owned to avoid nagging */
      setOwned(true);
    } finally {
      setOwning(false);
    }
  }, [id, owning, owned, user, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await api.products.get(id);
      setProduct(detail);
      setInsights(detail.insights);
      navigation.setOptions({ title: detail.brand ?? 'Produkt' });
      loadSecondary();
    } catch (e) {
      setError(e instanceof ApiError ? e.displayMessage : 'Produkt konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [id, navigation, loadSecondary]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh experiences/questions when returning from the rate/ask flows.
  useFocusEffect(
    useCallback(() => {
      if (product) loadSecondary();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id]),
  );

  if (loading) {
    return (
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    );
  }
  if (error || !product) {
    return (
      <Center>
        <Muted style={{ color: colors.regretInk, textAlign: 'center' }}>{error ?? 'Nicht gefunden.'}</Muted>
      </Center>
    );
  }

  const verdict = rebuyVerdict(product.rebuyScore, colors);
  const early = isEarlySignal(product.experienceCount);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.md }}
    >
      {/* Hero */}
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Ionicons name="cube-outline" size={36} color={colors.faint} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          {product.brand && (
            <Text style={{ color: colors.faint, fontSize: 13, fontWeight: '700' }}>{product.brand}</Text>
          )}
          <Text style={{ color: colors.label, fontSize: 21, fontWeight: '800', lineHeight: 26 }}>
            {product.canonicalName}
          </Text>
          {product.category && (
            <Pressable
              onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: product.category!.slug } })}
              style={{ flexDirection: 'row', marginTop: 8 }}
            >
              <Chip label={`${product.category.name}  ›`} tone="accent" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Verdict banner */}
      <Card style={{ backgroundColor: verdict.soft, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ScoreRing score={product.rebuyScore} size={88} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: verdict.ink, fontSize: 18, fontWeight: '800' }}>{verdict.short}</Text>
          <Text style={{ color: verdict.ink, fontSize: 14, marginTop: 2 }}>{verdict.label}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}>
            {dataConfidenceLabel(product.experienceCount)} · {product.experienceCount} Bewertungen
          </Text>
        </View>
      </Card>

      {/* Primary actions */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button
          title="Ich besitze es"
          onPress={() => router.push(`/product/${id}/own`)}
          icon={<Ionicons name="star" size={17} color="#fff" />}
          style={{ flex: 1 }}
        />
        <Button
          title="Fragen"
          variant="soft"
          onPress={() => router.push(`/product/${id}/ask`)}
          icon={<Ionicons name="help-circle-outline" size={18} color={colors.label} />}
          style={{ flex: 0, paddingHorizontal: 22 }}
        />
      </View>

      {/* Secondary: mark owned without rating */}
      <Pressable onPress={markOwned} disabled={owning || owned} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Ionicons name={owned ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={owned ? colors.positiveInk : colors.accent} />
        <Text style={{ color: owned ? colors.positiveInk : colors.accent, fontSize: 14, fontWeight: '600' }}>
          {owned ? 'Zu deinen Produkten hinzugefügt' : owning ? 'Wird hinzugefügt…' : 'Nur zu meinen Produkten'}
        </Text>
      </Pressable>

      {early && (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            backgroundColor: colors.unsureSoft,
            borderRadius: radius.md,
            padding: 12,
          }}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.unsureInk} />
          <Text style={{ color: colors.unsureInk, fontSize: 13, flex: 1 }}>
            Noch wenige Bewertungen — die Wertung kann sich noch deutlich ändern.
          </Text>
        </View>
      )}

      {/* AI headline */}
      {insights?.aiHeadline && (
        <Card>
          <Text style={{ color: colors.label, fontSize: 15, fontStyle: 'italic', lineHeight: 22 }}>
            „{insights.aiHeadline}"
          </Text>
        </Card>
      )}

      {/* Stat row */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stat label="Besitzer" value={String(product.ownerCount)} />
        <Stat label="Bewertungen" value={String(product.experienceCount)} />
        <Stat
          label="Netz-Konsens"
          value={product.externalAvgPercent !== null ? `${product.externalAvgPercent}%` : '–'}
        />
      </View>

      {/* Aspects */}
      {insights && (insights.topPositiveAspects.length > 0 || insights.topNegativeAspects.length > 0) && (
        <Card>
          <SectionTitle title="Was Besitzer sagen" />
          {insights.topPositiveAspects.slice(0, 4).map((a) => (
            <AspectRow key={`p-${a.key}`} label={a.label} count={a.count} tone="positive" />
          ))}
          {insights.topNegativeAspects.slice(0, 4).map((a) => (
            <AspectRow key={`n-${a.key}`} label={a.label} count={a.count} tone="negative" />
          ))}
        </Card>
      )}

      {/* Wish-known */}
      {insights && insights.wishKnownHighlights.length > 0 && (
        <Card>
          <SectionTitle title="Das hätten sie gern vorher gewusst" />
          {insights.wishKnownHighlights.slice(0, 4).map((w, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: i === 0 ? 4 : 8 }}>
              <Text style={{ color: colors.unsureInk }}>•</Text>
              <Text style={{ color: colors.inkSoft, flex: 1, fontSize: 14 }}>{w}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* External ratings */}
      {product.externalRatings.length > 0 && (
        <Card>
          <SectionTitle title="Bewertungen anderswo" />
          {product.externalRatings.map((r) => (
            <ExternalRatingRow key={r.id} rating={r} />
          ))}
        </Card>
      )}

      {/* Specs */}
      {product.specs.length > 0 && (
        <Card>
          <SectionTitle title="Technische Daten" />
          {product.specs.slice(0, 8).map((s, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }}>{s.label}</Text>
              <Text style={{ color: colors.label, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>
                {s.value}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Experiences */}
      {experiences.length > 0 && (
        <Card>
          <SectionTitle title="Erfahrungen echter Besitzer" />
          {experiences.slice(0, 5).map((e) => (
            <View key={e.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <Chip
                  label={WOULD_BUY_AGAIN_LABEL[e.wouldBuyAgain]}
                  tone={e.wouldBuyAgain === 'YES' ? 'positive' : e.wouldBuyAgain === 'NO' ? 'negative' : 'neutral'}
                />
                <Chip label={EXPERIENCE_MOOD_LABEL[e.experienceMood]} />
                <Chip label={USAGE_DURATION_LABEL[e.usageDuration]} />
              </View>
              {e.freeText && <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 20 }}>{e.freeText}</Text>}
              <Text style={{ color: colors.faint, fontSize: 12, marginTop: 4 }}>
                {e.authorName ?? 'Anonym'}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Showcases — clearly-labelled creator/brand content */}
      {showcases.length > 0 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="sparkles" size={15} color={colors.accent} />
            <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>Von Creators & Marken</Text>
          </View>
          <View style={{ gap: 10 }}>
            {showcases.map((s) => {
              const meta = DISCLOSURE_META[s.disclosureType];
              return (
                <Pressable key={s.id} onPress={() => router.push({ pathname: '/showcases/[id]', params: { id: s.id } })}>
                  <Card style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700', flex: 1 }}>{s.title}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {s.profile.displayName}
                      {meta ? ` · ${meta.label}` : ''}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Questions & Answers */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>
            Fragen & Antworten{questions.length > 0 ? ` · ${questions.length}` : ''}
          </Text>
          <Pressable onPress={() => router.push(`/product/${id}/ask`)}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Frage stellen</Text>
          </Pressable>
        </View>
        {questions.length > 0 ? (
          questions.map((q) => <QuestionCard key={q.id} question={q} onAnswered={() => {}} />)
        ) : (
          <Card>
            <Muted style={{ textAlign: 'center' }}>Noch keine Fragen. Stell die erste.</Muted>
          </Card>
        )}
      </View>

      {/* Similar products */}
      {similar.length > 0 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>Ähnliche Produkte</Text>
            <Pressable
              onPress={() => router.push('/compare')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="git-compare-outline" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Vergleichen</Text>
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {similar.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800', marginBottom: 8 }}>{title}</Text>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.label, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function AspectRow({ label, count, tone }: { label: string; count: number; tone: 'positive' | 'negative' }) {
  const { colors } = useTheme();
  const color = tone === 'positive' ? colors.positiveInk : colors.regretInk;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
      <Ionicons name={tone === 'positive' ? 'add-circle' : 'remove-circle'} size={16} color={color} />
      <Text style={{ color: colors.label, fontSize: 14, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.faint, fontSize: 13, fontWeight: '700' }}>{count}×</Text>
    </View>
  );
}

function ExternalRatingRow({ rating }: { rating: ExternalRatingDto }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => rating.url && Linking.openURL(rating.url)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.label, fontSize: 14, fontWeight: '600' }}>{rating.sourceLabel}</Text>
        {rating.note && <Text style={{ color: colors.faint, fontSize: 12 }}>{rating.note}</Text>}
      </View>
      <Text style={{ color: colors.label, fontSize: 14, fontWeight: '700' }}>
        {rating.value}/{rating.maxValue}
        {rating.count !== null ? ` · ${rating.count}` : ''}
      </Text>
      <Ionicons name="open-outline" size={15} color={colors.faint} />
    </Pressable>
  );
}
