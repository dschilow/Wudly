import type { ApiErrorDto } from '@wudly/shared';
import { getApiBaseUrl } from './config';

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
    return Array.isArray(msg) ? msg.join(' · ') : msg;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body; serialized automatically. */
  json?: unknown;
  /** Bearer token (used server-side where cookies aren't auto-attached). */
  token?: string;
  /** Next.js fetch cache controls (RSC). */
  next?: { revalidate?: number; tags?: string[] };
  cache?: RequestCache;
}

/**
 * Core typed fetch wrapper.
 *
 * Sends/receives JSON, attaches credentials so the HttpOnly auth cookie flows on
 * same-site browser requests, and throws {@link ApiError} on non-2xx with the
 * parsed error envelope. Works in both server and client components.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, token, headers, ...rest } = options;
  const url = `${getApiBaseUrl()}${path}`;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    // Browser: send cookies for auth. Server: harmless.
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
      (errorBody && (Array.isArray(errorBody.message) ? errorBody.message[0] : errorBody.message)) ??
      `Request failed (${response.status})`;
    throw new ApiError(response.status, message, errorBody);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
