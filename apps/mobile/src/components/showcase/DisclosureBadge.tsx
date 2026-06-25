import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DISCLOSURE_META } from '@wudly/shared';
import { useTheme } from '@/theme/ThemeProvider';

/** Always-on transparency badge for creator/brand content (commercial flagged). */
export function DisclosureBadge({ type, withHint }: { type: string; withHint?: boolean }) {
  const { colors, radius } = useTheme();
  const meta = DISCLOSURE_META[type];
  if (!meta) return null;

  const tone =
    meta.tone === 'commercial'
      ? { bg: colors.regretSoft, fg: colors.regretInk, icon: 'megaphone' as const }
      : meta.tone === 'warning'
        ? { bg: colors.unsureSoft, fg: colors.unsureInk, icon: 'alert-circle' as const }
        : { bg: colors.accentSoft, fg: colors.accentInk, icon: 'shield-checkmark' as const };

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          backgroundColor: tone.bg,
          borderRadius: radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}
      >
        <Ionicons name={tone.icon} size={14} color={tone.fg} />
        <Text style={{ color: tone.fg, fontSize: 13, fontWeight: '700' }}>{meta.label}</Text>
      </View>
      {withHint && <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>{meta.hint}</Text>}
    </View>
  );
}
