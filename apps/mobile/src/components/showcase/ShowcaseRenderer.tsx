import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ShowcaseBlockDto, ShowcaseDetailDto } from '@wudly/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/components/ui';
import { DisclosureBadge } from './DisclosureBadge';
import { num, qaItems, specItems, str, strArray, titledItems } from './blocks';

/** Renders a published Showcase from its blocks — clearly-labelled creator content. */
export function ShowcaseRenderer({ showcase }: { showcase: ShowcaseDetailDto }) {
  return (
    <View style={{ gap: 14 }}>
      <DisclosureHeader showcase={showcase} />
      {showcase.blocks.map((block) => (
        <Block key={block.id} block={block} showcase={showcase} />
      ))}
    </View>
  );
}

function DisclosureHeader({ showcase }: { showcase: ShowcaseDetailDto }) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { profile } = showcase;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={() => router.push({ pathname: '/creator/[slug]', params: { slug: profile.slug } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fill2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {profile.logoUrl ? (
            <Image source={{ uri: profile.logoUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Text style={{ color: colors.mutedForeground, fontSize: 18, fontWeight: '800' }}>
              {profile.displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>{profile.displayName}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Präsentiert von einem Wudly-Profil · kein Teil des neutralen Scores
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Pressable>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 14 }}>
        <DisclosureBadge type={showcase.disclosureType} withHint />
        {showcase.affiliateDisclosure && (
          <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 8 }}>{showcase.affiliateDisclosure}</Text>
        )}
      </View>
    </Card>
  );
}

function Block({ block, showcase }: { block: ShowcaseBlockDto; showcase: ShowcaseDetailDto }) {
  const { colors, radius } = useTheme();
  const c = block.content;

  switch (block.type) {
    case 'HERO': {
      const headline = str(c, 'headline') ?? showcase.title;
      const subline = str(c, 'subline') ?? showcase.subtitle;
      const eyebrow = str(c, 'eyebrow');
      return (
        <Card>
          {eyebrow && (
            <Text style={{ color: colors.accentInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>{eyebrow}</Text>
          )}
          <Text style={{ color: colors.label, fontSize: 24, fontWeight: '800', marginTop: 6, lineHeight: 28 }}>{headline}</Text>
          {subline && <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 8, lineHeight: 21 }}>{subline}</Text>}
        </Card>
      );
    }

    case 'PROMISE': {
      const items = strArray(c, 'items');
      if (!items.length) return null;
      return (
        <BlockShell title="Das Produktversprechen" icon="checkmark-circle">
          {items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
              <Ionicons name="checkmark-circle" size={17} color={colors.positiveInk} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: colors.label, fontSize: 15, lineHeight: 20 }}>{item}</Text>
            </View>
          ))}
        </BlockShell>
      );
    }

    case 'AUDIENCE': {
      const items = strArray(c, 'items');
      if (!items.length) return null;
      return (
        <BlockShell title="Für wen ist das gedacht" icon="people">
          <ChipRow items={items} />
        </BlockShell>
      );
    }

    case 'FEATURE_CARDS': {
      const cards = titledItems(c, 'cards');
      if (!cards.length) return null;
      return (
        <BlockShell title="Features" icon="star">
          <View style={{ gap: 10 }}>
            {cards.map((card, i) => (
              <View key={i} style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 14 }}>
                <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>{card.title}</Text>
                {card.text && <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{card.text}</Text>}
              </View>
            ))}
          </View>
        </BlockShell>
      );
    }

    case 'USE_CASES': {
      const items = titledItems(c, 'items');
      if (!items.length) return null;
      return (
        <BlockShell title="Anwendungsfälle" icon="list">
          {items.map((item, i) => (
            <View key={i} style={{ paddingVertical: 6 }}>
              <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>{item.title}</Text>
              {item.text && <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 2, lineHeight: 19 }}>{item.text}</Text>}
            </View>
          ))}
        </BlockShell>
      );
    }

    case 'PROBLEM_SOLUTION': {
      const problem = str(c, 'problem');
      const solution = str(c, 'solution');
      if (!problem && !solution) return null;
      return (
        <BlockShell title="Problem & Lösung" icon="bulb">
          {problem && (
            <View style={{ backgroundColor: colors.regretSoft, borderRadius: radius.md, padding: 14, marginBottom: 10 }}>
              <Text style={{ color: colors.regretInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Problem</Text>
              <Text style={{ color: colors.label, fontSize: 15, marginTop: 4, lineHeight: 20 }}>{problem}</Text>
            </View>
          )}
          {solution && (
            <View style={{ backgroundColor: colors.positiveSoft, borderRadius: radius.md, padding: 14 }}>
              <Text style={{ color: colors.positiveInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Lösung</Text>
              <Text style={{ color: colors.label, fontSize: 15, marginTop: 4, lineHeight: 20 }}>{solution}</Text>
            </View>
          )}
        </BlockShell>
      );
    }

    case 'COMPARISON': {
      const criteria = strArray(c, 'criteria');
      const note = str(c, 'note');
      if (!criteria.length) return null;
      return (
        <BlockShell title="Vergleichskriterien" icon="list">
          <ChipRow items={criteria} />
          {note && <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{note}</Text>}
        </BlockShell>
      );
    }

    case 'TECH_SPECS': {
      const specs = specItems(c, 'specs');
      if (!specs.length) return null;
      return (
        <BlockShell title="Technische Daten" icon="list">
          {specs.map((spec, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, flex: 1 }}>{spec.label}</Text>
              <Text style={{ color: colors.label, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' }}>{spec.value}</Text>
            </View>
          ))}
        </BlockShell>
      );
    }

    case 'FAQ': {
      const items = qaItems(c, 'items');
      if (!items.length) return null;
      return (
        <BlockShell title="Häufige Fragen" icon="help-circle">
          {items.map((item, i) => (
            <View key={i} style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 14, marginTop: i === 0 ? 0 : 8 }}>
              <Text style={{ color: colors.label, fontSize: 15, fontWeight: '600' }}>{item.q}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 6, lineHeight: 19 }}>{item.a}</Text>
            </View>
          ))}
        </BlockShell>
      );
    }

    case 'CREATOR_VERDICT': {
      const verdict = str(c, 'verdict');
      const text = str(c, 'text');
      const rating = num(c, 'rating');
      if (!verdict && !text) return null;
      return (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbox-ellipses" size={18} color={colors.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accentInk, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Creator-Fazit</Text>
              {verdict && <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>{verdict}</Text>}
            </View>
          </View>
          {rating !== null && rating > 0 && (
            <View style={{ flexDirection: 'row', gap: 2, marginTop: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons key={i} name="star" size={16} color={i < rating ? colors.unsure : colors.fill2} />
              ))}
            </View>
          )}
          {text && <Text style={{ color: colors.label, fontSize: 15, marginTop: 10, lineHeight: 21 }}>{text}</Text>}
        </Card>
      );
    }

    case 'BRAND_STATEMENT': {
      const text = str(c, 'text');
      if (!text) return null;
      return (
        <BlockShell title="Hersteller-Statement" icon="chatbox-ellipses">
          <Text style={{ color: colors.label, fontSize: 15, lineHeight: 21 }}>{text}</Text>
        </BlockShell>
      );
    }

    case 'BUY_LINK': {
      const label = str(c, 'label') ?? 'Zum Shop';
      const url = str(c, 'url');
      if (!url) return null;
      return <LinkButton label={label} url={url} primary />;
    }

    case 'CTA': {
      const label = str(c, 'label');
      const url = str(c, 'url');
      if (!label || !url) return null;
      return <LinkButton label={label} url={url} />;
    }

    case 'AFFILIATE_NOTE': {
      const text = str(c, 'text') ?? 'Diese Seite enthält Affiliate-Links.';
      return (
        <View style={{ backgroundColor: colors.unsureSoft, borderRadius: radius.md, padding: 12 }}>
          <Text style={{ color: colors.unsureInk, fontSize: 13, lineHeight: 18 }}>{text}</Text>
        </View>
      );
    }

    default:
      // DISCLOSURE (shown in header), GALLERY/CHART/VIDEO/DOWNLOADS — skip gracefully.
      return null;
  }
}

function BlockShell({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Ionicons name={icon} size={17} color={colors.accent} />
        <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function ChipRow({ items }: { items: string[] }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={{ backgroundColor: colors.fill2, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}>
          <Text style={{ color: colors.label, fontSize: 14 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function LinkButton({ label, url, primary }: { label: string; url: string; primary?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{
        height: 48,
        borderRadius: radius.md,
        backgroundColor: primary ? colors.accent : colors.fill2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
      }}
    >
      <Text style={{ color: primary ? '#fff' : colors.label, fontSize: 16, fontWeight: '700' }}>{label}</Text>
      <Ionicons name="arrow-forward" size={17} color={primary ? '#fff' : colors.label} />
    </Pressable>
  );
}
