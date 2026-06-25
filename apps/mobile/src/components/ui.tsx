/** Small shared UI primitives styled with the Verdict palette. */
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type ViewProps,
  type TextProps,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Card({ style, children, ...rest }: ViewProps) {
  const { colors, radius } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: 'primary' | 'soft' | 'ghost';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ title, variant = 'primary', loading, icon, style, disabled, ...rest }: ButtonProps) {
  const { colors, radius } = useTheme();
  const bg =
    variant === 'primary' ? colors.accent : variant === 'soft' ? colors.fill2 : 'transparent';
  const fg = variant === 'primary' ? '#fff' : colors.label;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={(state) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'positive' | 'negative' | 'accent' }) {
  const { colors, radius } = useTheme();
  const map = {
    neutral: { bg: colors.fill2, fg: colors.mutedForeground },
    positive: { bg: colors.positiveSoft, fg: colors.positiveInk },
    negative: { bg: colors.regretSoft, fg: colors.regretInk },
    accent: { bg: colors.accentSoft, fg: colors.accentInk },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Muted({ style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ color: colors.mutedForeground, fontSize: 14 }, style]} />;
}

export function Title({ style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ color: colors.label, fontSize: 22, fontWeight: '800' }, style]} />;
}

export function Center({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>{children}</View>;
}
