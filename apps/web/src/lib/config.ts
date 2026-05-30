/**
 * Resolves the API base URL.
 *
 * - Browser: always the public NEXT_PUBLIC_API_URL.
 * - Server (RSC / route handlers): prefer API_URL_INTERNAL (e.g. Railway private
 *   networking) when set, else fall back to the public URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.API_URL_INTERNAL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api'
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
}
