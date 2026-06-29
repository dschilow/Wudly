import type { ApiErrorDto } from '@wudly/shared';
import { getApiBaseUrl } from './config';

const CSRF_COOKIE_NAME = 'wudly_csrf';
const CSRF_HEADER_NAME = 'x-wudly-csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: ApiErrorDto,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Flattens the API's message (string | string[]) into one display string. */
  get displayMessage(): string {
    const msg = this.body?.message ?? this.message;
    return Array.isArray(msg) ? msg.join(' | ') : msg;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body; serialized automatically. */
  json?: unknown;
  /** Bearer token override for non-browser/server calls. Browser auth uses HttpOnly cookies. */
  token?: string;
  /** Next.js fetch cache controls (RSC). */
  next?: { revalidate?: number; tags?: string[] };
  cache?: RequestCache;
}

/**
 * Core typed fetch wrapper.
 *
 * Browser auth intentionally relies on the API's HttpOnly cookie. We do not keep
 * a second bearer token in localStorage, so an XSS cannot exfiltrate the session
 * token. Mutating cookie-authenticated requests include a double-submit CSRF
 * header from the readable CSRF cookie set by the API on login/register.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, token, headers, method, ...rest } = options;
  const url = `${getApiBaseUrl()}${path}`;
  const effectiveMethod = (method ?? 'GET').toUpperCase();

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

  const csrfToken = !SAFE_METHODS.has(effectiveMethod) ? readCookie(CSRF_COOKIE_NAME) : null;
  if (csrfToken && !finalHeaders[CSRF_HEADER_NAME]) finalHeaders[CSRF_HEADER_NAME] = csrfToken;

  const response = await fetch(url, {
    ...rest,
    method,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    // Browser: send HttpOnly auth cookie. Server: harmless.
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const errorBody = data as ApiErrorDto | undefined;
    const message =
      (errorBody &&
        (Array.isArray(errorBody.message) ? errorBody.message[0] : errorBody.message)) ??
      `Request failed (${response.status})`;
    throw new ApiError(response.status, message, errorBody);
  }

  return data as T;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(prefix.length));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
