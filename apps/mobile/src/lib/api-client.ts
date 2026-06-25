import type { ApiErrorDto } from '@wudly/shared';
import { getApiBaseUrl } from './config';
import { getAccessToken } from './auth-store';

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
  /** Override the stored bearer token (e.g. for an invite flow). */
  token?: string;
  /** Abort/timeout signal. */
  signal?: AbortSignal;
}

/** Network timeout for all requests (ms). The phone may be on flaky mobile data. */
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Core typed fetch wrapper for the app.
 *
 * Native has no cookie jar, so auth is the Bearer token from SecureStore.
 * Throws {@link ApiError} on non-2xx with the parsed error envelope.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, token, headers, signal, ...rest } = options;
  const url = `${getApiBaseUrl()}${path}`;
  const authToken = token ?? (await getAccessToken());

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (authToken) finalHeaders['Authorization'] = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new ApiError(0, 'Zeitüberschreitung. Bitte Verbindung prüfen.');
    }
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const errorBody = data as ApiErrorDto | undefined;
    const message =
      (errorBody && (Array.isArray(errorBody.message) ? errorBody.message[0] : errorBody.message)) ??
      `Anfrage fehlgeschlagen (${response.status})`;
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
