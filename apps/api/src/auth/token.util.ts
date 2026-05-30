import type { RequestWithUser } from './auth.types';

export const AUTH_COOKIE_NAME = 'wudly_token';

/**
 * Extracts a bearer token from either the `Authorization` header or the auth
 * cookie. Supporting both lets browsers use a secure HttpOnly cookie while
 * non-browser clients (tests, mobile) can use the Authorization header.
 */
export function extractToken(request: RequestWithUser): string | null {
  const authHeader = request.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  return null;
}
