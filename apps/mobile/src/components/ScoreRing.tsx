import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { rebuyVerdict } from '@/theme/verdict';

interface Props {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}

/** The Wudly rebuy score as a colored ring — the signature element of the app. */
export function ScoreRing({ score, size = 84, strokeWidth = 7 }: Props) {
  const { colors } = useTheme();
  const verdict = rebuyVerdict(score, colors);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={verdict.soft}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={verdict.color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.3, fontWeight: '800', color: verdict.color }}>
        {score === null ? '–' : score}
      </Text>
      {score !== null && (
        <Text style={{ fontSize: size * 0.13, fontWeight: '700', color: colors.faint, marginTop: -2 }}>
          %
        </Text>
      )}
    </View>
  );
}
