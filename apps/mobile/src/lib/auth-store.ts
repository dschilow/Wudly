/**
 * Persistent access-token storage. Uses Expo SecureStore (Android Keystore /
 * iOS Keychain) so the JWT never lands in plain AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'wudly_access_token';

let cachedToken: string | null | undefined;

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = (await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)) ?? null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setAccessToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  } catch {
    /* keychain unavailable on some emulators; in-memory cache still works */
  }
}

export async function clearAccessToken(): Promise<void> {
  cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
