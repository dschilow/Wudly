import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ImageBackfillReportDto, ImagelessProductDto, MergeCandidateDto, ProductCurationResearchDto, RatingBackfillReportDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Center, Muted } from '@/components/ui';

export default function AdminScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [merges, setMerges] = useState<MergeCandidateDto[]>([]);
  const [imageless, setImageless] = useState<ImagelessProductDto[]>([]);
  const [query, setQuery] = useState('');
  const [research, setResearch] = useState<ProductCurationResearchDto | null>(null);
  const [imageReport, setImageReport] = useState<ImageBackfillReportDto | null>(null);
  const [ratingReport, setRatingReport] = useState<RatingBackfillReportDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || user.role !== 'ADMIN') return;
    setLoading(true);
    try {
      const [mergeRows, gaps] = await Promise.all([
        api.admin.mergeCandidates().catch(() => []),
        api.admin.imagelessProducts().catch(() => []),
      ]);
      setMerges(mergeRows);
      setImageless(gaps);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  if (authLoading || loading) return <Center><ActivityIndicator color={colors.accent} /></Center>;
  if (!user || user.role !== 'ADMIN') {
    return <Center><Muted style={{ textAlign: 'center' }}>Dieser Bereich ist nur fuer Admins.</Muted></Center>;
  }

  const inputStyle = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, color: colors.label, fontSize: 16 } as const;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={{ color: colors.label, fontSize: 28, fontWeight: '800' }}>Admin</Text>
          <Muted style={{ marginTop: 4 }}>Produktdaten, Backfills und Merge-Kandidaten.</Muted>
        </View>

        {error && <Text style={{ color: colors.regretInk }}>{error}</Text>}

        <Card style={{ gap: 12 }}>
          <Section title="Katalog-Recherche" icon="search-outline" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Produkt, EAN oder Kategorie" placeholderTextColor={colors.faint} style={inputStyle} />
          <Button
            title="Recherchieren"
            onPress={() => run('research', async () => setResearch(await api.admin.curationResearch(query.trim())))}
            loading={busy === 'research'}
            disabled={query.trim().length < 2}
          />
          {research && (
            <View style={{ gap: 10 }}>
              <Muted>{research.catalog.length} Katalogtreffer, {research.market.length} Marktvorschlaege, Suche {research.searchEnabled ? 'aktiv' : 'aus'}.</Muted>
              {research.productSources.slice(0, 3).map((source) => (
                <Pressable key={source.url} onPress={() => Linking.openURL(source.url)} style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 10 }}>
                  <Text numberOfLines={1} style={{ color: colors.label, fontWeight: '800' }}>{source.title}</Text>
                  <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 3 }}>{source.description}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <Card style={{ gap: 12 }}>
          <Section title="Bildluecken" icon="image-outline" />
          <Text style={{ color: colors.label, fontSize: 30, fontWeight: '800' }}>{imageless.length}</Text>
          <Muted>Produkte ohne gecachtes Foto.</Muted>
          <Button
            title="Bilder backfillen"
            onPress={() => run('images', async () => {
              const report = await api.admin.backfillImages();
              setImageReport(report);
              await load();
            })}
            loading={busy === 'images'}
          />
          {imageReport && <ReportLine text={imageReport.found + ' von ' + imageReport.attempted + ' gefunden, ' + imageReport.remaining + ' verbleibend'} />}
          {imageless.slice(0, 5).map((item) => (
            <Muted key={item.id}>{item.canonicalName} {item.categoryName ? '- ' + item.categoryName : ''}</Muted>
          ))}
        </Card>

        <Card style={{ gap: 12 }}>
          <Section title="Externe Ratings" icon="star-outline" />
          <Button
            title="Ratings backfillen"
            onPress={() => run('ratings', async () => setRatingReport(await api.admin.backfillRatings()))}
            loading={busy === 'ratings'}
          />
          {ratingReport && <ReportLine text={ratingReport.totalFound + ' Ratings fuer ' + ratingReport.withRatings + ' Produkte, ' + ratingReport.remaining + ' verbleibend'} />}
        </Card>

        <Card style={{ gap: 12 }}>
          <Section title="Merge-Kandidaten" icon="git-merge-outline" />
          {merges.length === 0 ? (
            <Muted>Keine offenen Kandidaten.</Muted>
          ) : (
            merges.slice(0, 12).map((candidate) => (
              <View key={candidate.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 8 }}>
                <Text style={{ color: colors.label, fontSize: 14, fontWeight: '800' }}>{candidate.productA.canonicalName}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{candidate.productB.canonicalName}</Text>
                {candidate.reason && <Muted>{candidate.reason}</Muted>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Mergen" onPress={() => run(candidate.id + '-merge', async () => { await api.admin.merge(candidate.id); await load(); })} loading={busy === candidate.id + '-merge'} style={{ flex: 1 }} />
                  <Button title="Ablehnen" variant="soft" onPress={() => run(candidate.id + '-reject', async () => { await api.admin.reject(candidate.id); await load(); })} loading={busy === candidate.id + '-reject'} style={{ flex: 1 }} />
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={19} color={colors.accent} />
      <Text style={{ color: colors.label, fontSize: 18, fontWeight: '800' }}>{title}</Text>
    </View>
  );
}

function ReportLine({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.positiveSoft, borderRadius: radius.md, padding: 10 }}>
      <Text style={{ color: colors.positiveInk, fontSize: 13, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}
