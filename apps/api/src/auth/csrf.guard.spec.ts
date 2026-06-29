import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './token.util';

function context(request: {
  method: string;
  path?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path: request.path ?? '/api/products', ...request }),
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  it('allows safe methods', () => {
    expect(guard.canActivate(context({ method: 'GET' }))).toBe(true);
  });

  it('allows bearer/mobile style writes without auth cookie', () => {
    expect(
      guard.canActivate(
        context({ method: 'POST', headers: { authorization: 'Bearer token' }, cookies: {} }),
      ),
    ).toBe(true);
  });

  it('rejects cookie-authenticated writes without matching csrf header', () => {
    expect(() =>
      guard.canActivate(
        context({
          method: 'POST',
          cookies: { [AUTH_COOKIE_NAME]: 'jwt', [CSRF_COOKIE_NAME]: 'csrf' },
          headers: {},
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows cookie-authenticated writes with matching csrf header', () => {
    expect(
      guard.canActivate(
        context({
          method: 'POST',
          cookies: { [AUTH_COOKIE_NAME]: 'jwt', [CSRF_COOKIE_NAME]: 'csrf' },
          headers: { [CSRF_HEADER_NAME]: 'csrf' },
        }),
      ),
    ).toBe(true);
  });
});
