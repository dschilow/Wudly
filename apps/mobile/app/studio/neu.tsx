import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DISCLOSURE_META, DisclosureType, type ProductSummaryDto, type ProductTemplateDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { DisclosureBadge } from '@/components/showcase/DisclosureBadge';
import { Button, Card, Center, Muted } from '@/components/ui';

const SELECTABLE_DISCLOSURES = (Object.values(DisclosureType) as DisclosureType[]).filter((d) => d !== DisclosureType.WUDLY_NATIVE);

export default function NewShowcaseScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummaryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<ProductSummaryDto | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [disclosureType, setDisclosureType] = useState<DisclosureType>(DisclosureType.INDEPENDENT_TEST);
  const [templates, setTemplates] = useState<ProductTemplateDto[]>([]);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    api.showcase.myProfile().then((p) => setHasProfile(Boolean(p))).catch(() => undefined).finally(() => setChecking(false));
  }, [authLoading, user]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2 || product) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(() => {
      api.products.search(q, 8).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 280);
  }, [query, product]);

  useEffect(() => {
    if (!product?.category?.slug) {
      setTemplates([]);
      setTemplateSlug(null);
      return;
    }
    api.showcase.templatesForCategory(product.category.slug).then(setTemplates).catch(() => setTemplates([]));
  }, [product]);

  const selectProduct = (item: ProductSummaryDto) => {
    setProduct(item);
    setQuery('');
    setResults([]);
    if (!title.trim()) setTitle(item.canonicalName);
  };

  const create = async () => {
    if (!product || title.trim().length < 2 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const showcase = await api.showcase.create(product.id, {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        disclosureType,
        templateSlug: templateSlug ?? undefined,
      });
      router.replace({ pathname: '/studio/showcases/[id]' as any, params: { id: showcase.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Showcase konnte nicht angelegt werden.');
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || checking) {
    return (
      <Center><ActivityIndicator color={colors.accent} /></Center>
    );
  }
  if (!user) {
    return <Center><Button title="Anmelden" onPress={() => router.push('/login')} /></Center>;
  }
  if (!hasProfile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <Ionicons name="sparkles-outline" size={56} color={colors.accent} />
          <Text style={{ color: colors.label, fontSize: 23, fontWeight: '800', textAlign: 'center' }}>Profi-Profil noetig</Text>
          <Muted style={{ textAlign: 'center' }}>Lege zuerst ein professionelles Profil an.</Muted>
          <Button title="Profil anlegen" onPress={() => router.replace('/studio/profil' as any)} />
        </View>
      </SafeAreaView>
    );
  }

  const inputStyle = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, color: colors.label, fontSize: 16 } as const;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={{ color: colors.label, fontSize: 27, fontWeight: '800' }}>Neues Showcase</Text>
          <Muted style={{ marginTop: 4 }}>Waehle ein Produkt und Transparenzlabel. Inhalte bearbeitest du danach im Editor.</Muted>
        </View>

        <View style={{ gap: 8 }}>
          <Label text="1 - Produkt" />
          {product ? (
            <SelectedProduct product={product} onRemove={() => setProduct(null)} />
          ) : (
            <View style={{ gap: 8 }}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Produkt suchen..." placeholderTextColor={colors.faint} style={inputStyle} />
              {searching && <ActivityIndicator color={colors.accent} />}
              {results.map((item) => <ProductResult key={item.id} product={item} onPress={() => selectProduct(item)} />)}
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Label text="2 - Titel" />
          <TextInput value={title} onChangeText={setTitle} placeholder="Titel des Showcases" placeholderTextColor={colors.faint} style={inputStyle} />
          <TextInput value={subtitle} onChangeText={setSubtitle} placeholder="Untertitel (optional)" placeholderTextColor={colors.faint} style={inputStyle} />
        </View>

        <View style={{ gap: 8 }}>
          <Label text="3 - Transparenz" />
          {SELECTABLE_DISCLOSURES.map((value) => {
            const active = disclosureType === value;
            const meta = DISCLOSURE_META[value];
            return (
              <Pressable key={value} onPress={() => setDisclosureType(value)}>
                <Card style={{ borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSoft : colors.surface }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <DisclosureBadge type={value} />
                      {meta?.hint && <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>{meta.hint}</Text>}
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        {templates.length > 0 && (
          <View style={{ gap: 8 }}>
            <Label text="4 - Vorlage" />
            <TemplateRow active={templateSlug === null} title="Leer starten" subtitle="Ohne Vorlagenbloecke" onPress={() => setTemplateSlug(null)} />
            {templates.map((template) => (
              <TemplateRow key={template.slug} active={templateSlug === template.slug} title={template.name} subtitle={(template.description ?? '') + ' - ' + template.blocks.length + ' Bloecke'} onPress={() => setTemplateSlug(template.slug)} />
            ))}
          </View>
        )}

        {error && <Text style={{ color: colors.regretInk }}>{error}</Text>}
        <Button title="Showcase anlegen" onPress={create} loading={creating} disabled={!product || title.trim().length < 2} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>{text}</Text>;
}

function ProductThumb({ product }: { product: ProductSummaryDto }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="cube-outline" size={20} color={colors.faint} />}
    </View>
  );
}

function SelectedProduct({ product, onRemove }: { product: ProductSummaryDto; onRemove: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <ProductThumb product={product} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.label, fontSize: 15, fontWeight: '800' }}>{product.canonicalName}</Text>
        <Muted>{product.brand ?? product.category?.name ?? 'Produkt'}</Muted>
      </View>
      <Pressable onPress={onRemove} hitSlop={8}><Ionicons name="close-circle" size={22} color={colors.faint} /></Pressable>
    </Card>
  );
}

function ProductResult({ product, onPress }: { product: ProductSummaryDto; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
      <ProductThumb product={product} />
      <Text numberOfLines={1} style={{ flex: 1, color: colors.label, fontSize: 15, fontWeight: '700' }}>{product.canonicalName}</Text>
      <Ionicons name="add-circle" size={22} color={colors.accent} />
    </Pressable>
  );
}

function TemplateRow({ active, title, subtitle, onPress }: { active: boolean; title: string; subtitle: string; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: active ? colors.accentSoft : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: active ? colors.accent : colors.border, padding: 14 }}>
      <Ionicons name="layers-outline" size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.label, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {active && <Ionicons name="checkmark-circle" size={21} color={colors.accent} />}
    </Pressable>
  );
}
