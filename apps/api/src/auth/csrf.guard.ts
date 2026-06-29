import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './token.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/auth/login',
  '/auth/register',
  '/auth/logout',
]);

/**
 * Double-submit CSRF protection for browser cookie auth.
 *
 * Mobile and scripts authenticate with Authorization: Bearer and do not carry
 * the HttpOnly auth cookie, so they are outside this browser-CSRF threat model.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    if (CSRF_EXEMPT_PATHS.has(request.path)) return true;

    const authCookie = request.cookies?.[AUTH_COOKIE_NAME];
    if (!authCookie) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers[CSRF_HEADER_NAME];
    const submitted = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!cookieToken || typeof submitted !== 'string' || submitted !== cookieToken) {
      throw new ForbiddenException('Sicherheitspruefung fehlgeschlagen. Bitte Seite neu laden.');
    }

    return true;
  }
}
