import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, radius, spacing, type Palette } from './colors';

export interface Theme {
  colors: Palette;
  radius: typeof radius;
  spacing: typeof spacing;
  isDark: boolean;
}

const ThemeContext = createContext<Theme>({
  colors: lightPalette,
  radius,
  spacing,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme: Theme = {
    colors: isDark ? darkPalette : lightPalette,
    radius,
    spacing,
    isDark,
  };
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
