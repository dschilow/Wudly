/**
 * Resolves the API base URL.
 *
 * - Browser: use the same-origin `/api` proxy so HttpOnly auth cookies are
 *   first-party to the web app instead of fragile cross-subdomain cookies.
 * - Server (RSC / route handlers): prefer API_URL_INTERNAL (e.g. Railway private
 *   networking) when set, else fall back to the public URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '/api';

  return (
    process.env.API_URL_INTERNAL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000/api'
  );
}
