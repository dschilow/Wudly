import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Linking, Pressable, Share } from 'react-native';
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
  ProductPromptDto,
  ShowcaseSummaryDto,
  InvitedVotesSummaryDto,
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
  const [prompts, setPrompts] = useState<ProductPromptDto[]>([]);
  const [showcases, setShowcases] = useState<ShowcaseSummaryDto[]>([]);
  const [invitedVotes, setInvitedVotes] = useState<InvitedVotesSummaryDto>({ count: 0, yesCount: 0, votes: [] });
  const [owning, setOwning] = useState(false);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSecondary = useCallback(() => {
    if (!id) return;
    void api.products.experiences(id).then(setExperiences).catch(() => {});
    void api.products.questions(id).then(setQuestions).catch(() => {});
    void api.products.prompts(id).then(setPrompts).catch(() => {});
    void api.products.similar(id).then(setSimilar).catch(() => {});
    void api.showcase.forProduct(id).then(setShowcases).catch(() => {});
    void api.invites.forProduct(id).then(setInvitedVotes).catch(() => {});
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

  const shareProduct = async () => {
    await Share.share({
      title: product.canonicalName + ' - Wuerdest du es wieder kaufen?',
      message:
        product.canonicalName +
        ': ' +
        (product.rebuyScore ?? '-') +
        '% wuerden es wieder kaufen. https://wudly.app/products/' +
        product.id,
    }).catch(() => {});
  };

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

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button
          title="Teilen"
          variant="soft"
          onPress={shareProduct}
          icon={<Ionicons name="share-outline" size={18} color={colors.label} />}
          style={{ flex: 1 }}
        />
        <Button
          title="Vergleichen"
          variant="soft"
          onPress={() => router.push({ pathname: '/compare', params: { ids: product.id } })}
          icon={<Ionicons name="git-compare-outline" size={18} color={colors.label} />}
          style={{ flex: 1 }}
        />
      </View>

      {/* Secondary: mark owned without rating */}
      <Pressable onPress={markOwned} disabled={owning || owned} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Ionicons name={owned ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={owned ? colors.positiveInk : colors.accent} />
        <Text style={{ color: owned ? colors.positiveInk : colors.accent, fontSize: 14, fontWeight: '600' }}>
          {owned ? 'Zu deinen Produkten hinzugefügt' : owning ? 'Wird hinzugefügt…' : 'Nur zu meinen Produkten'}
        </Text>
      </Pressable>

      <InviteCard productId={product.id} productName={product.canonicalName} />

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

      <DecisionBrief insights={product.insights} />

      {/* Stat row */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stat label="Besitzer" value={String(product.ownerCount)} />
        <Stat label="Bewertungen" value={String(product.experienceCount)} />
        <Stat
          label="Netz-Konsens"
          value={product.externalAvgPercent !== null ? `${product.externalAvgPercent}%` : '–'}
        />
      </View>

      <TrustPanel insights={product.insights} />
      <QuickSignalPanel insights={product.insights} />

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

      <OwnerVoices prompts={prompts} />

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

      {/* Netz-Konsens dossier: source-backed summary, long-term note, themes,
          and "switched to" alternatives — never part of the Wudly Signal. */}
      {product.externalConsensus && (
        <ExternalConsensusSection consensus={product.externalConsensus} />
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

      <InvitedVotesSection data={invitedVotes} />

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
              onPress={() => router.push({ pathname: '/compare', params: { ids: product.id } })}
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


function DecisionBrief({ insights }: { insights: ProductInsightsDto }) {
  const { colors, radius } = useTheme();
  const buyItems =
    insights.suitedFor.length > 0
      ? insights.suitedFor
      : insights.topPositiveAspects.map((a) => 'Wenn dir ' + a.label.toLowerCase() + ' wichtig ist').slice(0, 3);
  const avoidItems =
    insights.notSuitedFor.length > 0
      ? insights.notSuitedFor
      : insights.topNegativeAspects.map((a) => 'Wenn dich ' + a.label.toLowerCase() + ' stark stoert').slice(0, 3);
  const questions =
    insights.wishKnownHighlights.length > 0
      ? insights.wishKnownHighlights.slice(0, 3)
      : insights.topNegativeAspects.map((a) => 'Wie stark faellt ' + a.label.toLowerCase() + ' im Alltag auf?').slice(0, 3);

  if (buyItems.length === 0 && avoidItems.length === 0 && questions.length === 0 && insights.experienceCount === 0) {
    return null;
  }

  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle title="Kaufentscheidung" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <DecisionColumn
          title="Kaufen, wenn"
          icon="thumbs-up"
          color={colors.positiveInk}
          background={colors.positiveSoft}
          items={buyItems.length > 0 ? buyItems.slice(0, 3) : ['die ersten Besitzer weiter positive Langzeitdaten liefern']}
        />
        <DecisionColumn
          title="Lieber nicht, wenn"
          icon="thumbs-down"
          color={colors.regretInk}
          background={colors.regretSoft}
          items={avoidItems.length > 0 ? avoidItems.slice(0, 3) : ['du ohne mehr echte Nutzung kein Risiko eingehen willst']}
        />
      </View>
      {questions.length > 0 && (
        <View style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 12 }}>
          <Text style={{ color: colors.accentInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>
            Vor dem Kauf klaeren
          </Text>
          {questions.slice(0, 3).map((item, i) => (
            <Text key={i} style={{ color: colors.label, fontSize: 14, lineHeight: 19, marginTop: i === 0 ? 0 : 5 }}>
              - {item}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

function DecisionColumn({
  title,
  icon,
  color,
  background,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  items: string[];
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: background, borderRadius: radius.md, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', flex: 1 }}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <Text key={i} style={{ color: colors.label, fontSize: 13, lineHeight: 18 }}>
          - {item}
        </Text>
      ))}
    </View>
  );
}

function TrustPanel({ insights }: { insights: ProductInsightsDto }) {
  const { colors, radius } = useTheme();
  const verification = insights.verification;
  if (!verification) return null;
  const level =
    verification.total === 0
      ? 'Noch offen'
      : verification.verified > 0
        ? verification.verifiedShare >= 50
          ? 'Verifiziertes Signal'
          : 'Gemischter Nachweis'
        : 'Selbst deklariert';

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark-outline" size={21} color={colors.accentInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.accentInk, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>{level}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
            Verifizierte Besitzer zaehlen im Score staerker. Selbst deklarierte Stimmen bleiben sichtbar.
          </Text>
        </View>
      </View>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.fill2, overflow: 'hidden' }}>
        <View style={{ width: (verification.verifiedShare + '%') as any, height: '100%', backgroundColor: colors.accent }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TrustMetric label="Verifiziert" value={verification.verified} />
        <TrustMetric label="Selbst" value={verification.selfDeclared} />
        <TrustMetric label="Offen" value={verification.unverified} />
      </View>
    </Card>
  );
}

function TrustMetric({ label, value }: { label: string; value: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.fill2, borderRadius: radius.md, padding: 10, alignItems: 'center' }}>
      <Text style={{ color: colors.label, fontSize: 19, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function QuickSignalPanel({ insights }: { insights: ProductInsightsDto }) {
  const { colors, radius } = useTheme();
  const quick = insights.quickVotes;
  if (!quick || quick.count === 0) return null;
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.unsureSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash-outline" size={21} color={colors.unsureInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.label, fontSize: 26, fontWeight: '800' }}>{quick.rebuy !== null ? quick.rebuy + '%' : '-'}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
            {quick.count} Schnellcheck{quick.count === 1 ? '' : 's'}, getrennt vom belastbaren Wudly Signal.
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: colors.positiveSoft, borderRadius: radius.md, padding: 10 }}>
          <Text style={{ color: colors.positiveInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Wieder kaufen</Text>
          <Text style={{ color: colors.positiveInk, fontSize: 24, fontWeight: '800' }}>{quick.yes}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.regretSoft, borderRadius: radius.md, padding: 10 }}>
          <Text style={{ color: colors.regretInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Nie wieder</Text>
          <Text style={{ color: colors.regretInk, fontSize: 24, fontWeight: '800' }}>{quick.no}</Text>
        </View>
      </View>
    </Card>
  );
}

function OwnerVoices({ prompts }: { prompts: ProductPromptDto[] }) {
  const { colors, radius } = useTheme();
  const answered = prompts.filter((p) => p.responseCount > 0 && p.answerStats.length > 0).slice(0, 4);
  if (answered.length === 0) return null;
  return (
    <Card>
      <SectionTitle title="Das sagen Besitzer" />
      <View style={{ gap: 12 }}>
        {answered.map((prompt) => {
          const total = prompt.answerStats.reduce((sum, a) => sum + a.count, 0);
          return (
            <View key={prompt.id} style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 12 }}>
              <Text style={{ color: colors.label, fontSize: 14, fontWeight: '700', lineHeight: 19 }}>{prompt.questionText}</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {prompt.answerStats.slice(0, 4).map((stat) => {
                  const pct = total > 0 ? Math.round((stat.count / total) * 100) : 0;
                  return (
                    <View key={stat.label}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <Text numberOfLines={1} style={{ color: colors.label, fontSize: 13, flex: 1 }}>{stat.label}</Text>
                        <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>{stat.count}</Text>
                      </View>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden', marginTop: 4 }}>
                        <View style={{ width: (pct + '%') as any, height: '100%', backgroundColor: colors.accent }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function InvitedVotesSection({ data }: { data: InvitedVotesSummaryDto }) {
  const { colors, radius } = useTheme();
  if (data.count === 0) return null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-add-outline" size={19} color={colors.accentInk} />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle title="Eingeladene Stimmen" />
          <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>{data.yesCount} von {data.count} wuerden wieder kaufen</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>Von Bekannten per Einladung, separat ausgewiesen.</Text>
        </View>
      </View>
      {data.votes.slice(0, 5).map((vote) => (
        <View key={vote.id} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text numberOfLines={1} style={{ color: colors.label, fontSize: 14, fontWeight: '700', flex: 1 }}>{vote.guestName ?? 'Bekannte:r'}</Text>
            <Chip
              label={WOULD_BUY_AGAIN_LABEL[vote.wouldBuyAgain]}
              tone={vote.wouldBuyAgain === 'YES' ? 'positive' : vote.wouldBuyAgain === 'NO' ? 'negative' : 'neutral'}
            />
          </View>
          {vote.comment && <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: 5 }}>{vote.comment}</Text>}
        </View>
      ))}
    </Card>
  );
}

function InviteCard({ productId, productName }: { productId: string; productName: string }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.invites.create(productId);
      const url = res.url.startsWith('http') ? res.url : 'https://wudly.app' + res.url;
      await Share.share({
        title: 'Wudly - kurz bewerten',
        message: 'Du besitzt "' + productName + '"? Bewerte es in 10 Sekunden - ohne Anmeldung: ' + url,
      }).catch(() => {});
      setShared(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Konnte den Link nicht erstellen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={shared ? 'checkmark' : 'person-add-outline'} size={22} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.label, fontSize: 15, fontWeight: '800' }}>Kennst du jemanden mit diesem Produkt?</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: 2 }}>Lass es in 10 Sekunden bewerten, ohne Anmeldung.</Text>
        {error && <Text style={{ color: colors.regretInk, fontSize: 12, marginTop: 4 }}>{error}</Text>}
      </View>
      <Pressable
        onPress={invite}
        disabled={busy}
        style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14, opacity: busy ? 0.6 : 1 }}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{shared ? 'Geteilt' : 'Fragen'}</Text>
      </Pressable>
    </Card>
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

/** Source-backed public-review dossier: summary, long-term note, recurring
    themes and "switched to" alternatives. Orientation only — never the Wudly Signal. */
function ExternalConsensusSection({ consensus }: { consensus: ProductDetailDto['externalConsensus'] }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  if (!consensus) return null;

  const hasThemes = consensus.positiveThemes.length > 0 || consensus.negativeThemes.length > 0;
  const hasAlternatives = consensus.switchAlternatives.length > 0;
  if (!consensus.summary && !consensus.longTermNote && !hasThemes && !hasAlternatives) return null;

  return (
    <Card style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Ionicons name="globe-outline" size={16} color={colors.accentInk} />
        <Text style={{ color: colors.accentInk, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Netz-Konsens
        </Text>
      </View>

      {consensus.summary && (
        <Text style={{ color: colors.label, fontSize: 14, lineHeight: 20 }}>{consensus.summary}</Text>
      )}

      {consensus.longTermNote && (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            backgroundColor: colors.fill2,
            borderRadius: radius.md,
            padding: 10,
            marginTop: 10,
          }}
        >
          <Ionicons name="hourglass-outline" size={16} color={colors.accentInk} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
              Langzeit &amp; Haltbarkeit
            </Text>
            <Text style={{ color: colors.label, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
              {consensus.longTermNote}
            </Text>
          </View>
        </View>
      )}

      {hasThemes && (
        <View style={{ marginTop: 12, gap: 6 }}>
          {consensus.positiveThemes.slice(0, 3).map((theme) => (
            <ThemeRow key={theme.label} label={theme.label} tone="positive" />
          ))}
          {consensus.negativeThemes.slice(0, 3).map((theme) => (
            <ThemeRow key={theme.label} label={theme.label} tone="negative" />
          ))}
        </View>
      )}

      {hasAlternatives && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
            Dahin wechseln Nutzer
          </Text>
          {consensus.switchAlternatives.slice(0, 3).map((alt) => (
            <Pressable
              key={alt.name}
              disabled={!alt.productId}
              onPress={() =>
                alt.productId &&
                router.push({ pathname: '/product/[id]', params: { id: alt.productId } })
              }
              style={{
                backgroundColor: colors.fill2,
                borderRadius: radius.md,
                padding: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: colors.label, fontSize: 14, fontWeight: '700', flex: 1 }}>{alt.name}</Text>
                {alt.productId && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                {alt.reason}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

function ThemeRow({ label, tone }: { label: string; tone: 'positive' | 'negative' }) {
  const { colors } = useTheme();
  const color = tone === 'positive' ? colors.positiveInk : colors.regretInk;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={tone === 'positive' ? 'shield-checkmark' : 'alert-circle'} size={15} color={color} />
      <Text style={{ color: colors.label, fontSize: 13, flex: 1 }}>{label}</Text>
    </View>
  );
}
