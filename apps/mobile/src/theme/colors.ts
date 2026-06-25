/**
 * Wudly "Verdict" design tokens, ported 1:1 from the web's globals.css so the app
 * and the website share one color language. Light + dark palettes; resolved at
 * runtime by {@link useTheme}.
 */

export interface Palette {
  // Text
  label: string;
  label2: string;
  label3: string;
  ink: string;
  inkSoft: string;
  mutedForeground: string;
  faint: string;

  // Surfaces
  background: string;
  surface: string;
  surfaceSoft: string;
  surfaceMuted: string;
  surface2: string;
  surfaceSunken: string;

  // Fills / borders
  fill: string;
  fill2: string;
  border: string;
  borderStrong: string;

  // Accent (brand green)
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentInk: string;

  // Verdict bands
  positive: string;
  positiveSoft: string;
  positiveInk: string;
  regret: string;
  regretSoft: string;
  regretInk: string;
  unsure: string;
  unsureSoft: string;
  unsureInk: string;

  // Overlays
  scrim: string;
}

export const lightPalette: Palette = {
  label: '#0c0d12',
  label2: 'rgba(12,13,18,0.6)',
  label3: 'rgba(12,13,18,0.4)',
  ink: '#0c0d12',
  inkSoft: '#3a3d49',
  mutedForeground: '#5b5f6d',
  faint: '#9aa0ae',

  background: '#fbfbfd',
  surface: '#ffffff',
  surfaceSoft: '#fbfbfd',
  surfaceMuted: '#eef0f4',
  surface2: '#f1f2f6',
  surfaceSunken: '#e7e9ef',

  fill: 'rgba(12,13,18,0.04)',
  fill2: 'rgba(12,13,18,0.07)',
  border: 'rgba(12,13,18,0.08)',
  borderStrong: 'rgba(12,13,18,0.2)',

  accent: '#0aa06a',
  accentHover: '#088a5b',
  accentSoft: 'rgba(10,160,106,0.08)',
  accentInk: '#077951',

  positive: '#10a06a',
  positiveSoft: 'rgba(16,160,106,0.08)',
  positiveInk: '#0b7d50',
  regret: '#e0483a',
  regretSoft: 'rgba(224,72,58,0.08)',
  regretInk: '#bb3527',
  unsure: '#c8851a',
  unsureSoft: 'rgba(200,133,26,0.09)',
  unsureInk: '#9a6512',

  scrim: 'rgba(12,13,18,0.5)',
};

export const darkPalette: Palette = {
  label: '#eef0f5',
  label2: 'rgba(238,240,245,0.64)',
  label3: 'rgba(238,240,245,0.38)',
  ink: '#eef0f5',
  inkSoft: '#c4c7d2',
  mutedForeground: '#9b9fae',
  faint: '#5a5e6c',

  background: '#0e0f14',
  surface: '#15161d',
  surfaceSoft: '#191a22',
  surfaceMuted: '#1f2029',
  surface2: '#1c1d25',
  surfaceSunken: '#0e0f14',

  fill: 'rgba(255,255,255,0.04)',
  fill2: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.18)',

  accent: '#34e39b',
  accentHover: '#28cf8b',
  accentSoft: 'rgba(52,227,155,0.12)',
  accentInk: '#34e39b',

  positive: '#34e39b',
  positiveSoft: 'rgba(52,227,155,0.12)',
  positiveInk: '#34e39b',
  regret: '#ff6b5c',
  regretSoft: 'rgba(255,107,92,0.13)',
  regretInk: '#ff8478',
  unsure: '#e0a23a',
  unsureSoft: 'rgba(224,162,58,0.14)',
  unsureInk: '#edb95f',

  scrim: 'rgba(0,0,0,0.6)',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
