import Constants from 'expo-constants';

/**
 * Resolves the API base URL for the app.
 *
 * Source of truth is `expo.extra.apiUrl` in app.json (the deployed Railway API).
 * Falls back to the public prod URL so a misconfigured build still works.
 */
const FALLBACK_API_URL = 'https://wudly-api-production.up.railway.app/api';

export function getApiBaseUrl(): string {
  const fromExtra =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    (Constants.manifest2?.extra?.expoClient?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  return fromExtra ?? FALLBACK_API_URL;
}
