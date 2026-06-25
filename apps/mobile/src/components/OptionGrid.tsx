import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { EnumOption } from '@wudly/shared';
import type { CategoryAspectDto } from '@wudly/shared';
import { useTheme } from '@/theme/ThemeProvider';

/** Single-select list of large, tappable option rows (used in the rating wizard). */
export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<EnumOption<T>>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        const tone =
          opt.tone === 'positive'
            ? colors.positive
            : opt.tone === 'negative'
              ? colors.regret
              : opt.tone === 'warning'
                ? colors.unsure
                : colors.accent;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(opt.value);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 16,
              borderRadius: radius.lg,
              backgroundColor: active ? tone + '14' : colors.surface,
              borderWidth: active ? 2 : 1,
              borderColor: active ? tone : colors.border,
            }}
          >
            {opt.emoji && <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>}
            <Text style={{ flex: 1, fontSize: 17, fontWeight: active ? '700' : '500', color: colors.label }}>
              {opt.label}
            </Text>
            {active && (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: tone,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select chips for category aspects ("Was gefällt dir / Was nervt"). */
export function MultiSelectChips({
  options,
  selected,
  onToggle,
  tone,
}: {
  options: CategoryAspectDto[];
  selected: string[];
  onToggle: (key: string) => void;
  tone: 'positive' | 'negative';
}) {
  const { colors, radius } = useTheme();
  const accent = tone === 'positive' ? colors.positive : colors.regret;
  const accentSoft = tone === 'positive' ? colors.positiveSoft : colors.regretSoft;
  const accentInk = tone === 'positive' ? colors.positiveInk : colors.regretInk;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => {
              void Haptics.selectionAsync();
              onToggle(opt.key);
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: active ? accentSoft : colors.fill2,
              borderWidth: 1,
              borderColor: active ? accent : 'transparent',
            }}
          >
            <Text style={{ color: active ? accentInk : colors.label, fontWeight: active ? '700' : '500', fontSize: 14 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
