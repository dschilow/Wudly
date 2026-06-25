import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/lib/AuthContext';
import { darkPalette, lightPalette } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkPalette : lightPalette;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTitleStyle: { color: colors.label, fontWeight: '800' },
              headerTintColor: colors.accent,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]/index" options={{ title: '', headerBackTitle: 'Zurück' }} />
            <Stack.Screen name="product/[id]/own" options={{ title: 'Bewerten', headerBackTitle: 'Zurück' }} />
            <Stack.Screen name="product/[id]/ask" options={{ title: 'Fragen', headerBackTitle: 'Zurück' }} />
            <Stack.Screen name="category/[slug]" options={{ title: '', headerBackTitle: 'Zurück' }} />
            <Stack.Screen name="compare" options={{ title: 'Vergleich', headerBackTitle: 'Zurück' }} />
            <Stack.Screen name="showcases/[id]" options={{ title: '', headerBackTitle: 'Zurück' }} />
            <Stack.Screen name="creator/[slug]" options={{ title: '', headerBackTitle: 'Zurück' }} />
            <Stack.Screen
              name="login"
              options={{ title: 'Anmelden', presentation: 'modal' }}
            />
            <Stack.Screen
              name="scan"
              options={{ title: 'Barcode scannen', presentation: 'fullScreenModal', headerShown: false }}
            />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
