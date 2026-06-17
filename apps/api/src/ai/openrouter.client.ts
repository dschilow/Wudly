import { Logger } from '@nestjs/common';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  siteUrl?: string;
  appTitle: string;
}

/** A multimodal content part (OpenAI/OpenRouter format). */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  /** A plain string, or multimodal parts (text + images) for vision calls. */
  content: string | ChatContentPart[];
}

export interface JsonChatClient {
  readonly modelChain: readonly string[];
  completeJson(
    messages: ChatMessage[],
    opts?: { temperature?: number; maxTokens?: number; online?: boolean; timeoutMs?: number },
  ): Promise<string | null>;
  ping(): Promise<{ ok: boolean; model?: string; error?: string }>;
}

/** Token usage for a single chat completion (provider-normalised). */
export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Result of a plain-text chat completion (used by the admin model playground). */
export interface ChatTextResult {
  ok: boolean;
  /** The model actually used for this call. */
  model: string;
  text?: string;
  error?: string;
  status?: number;
  usage?: ChatUsage;
  /** Generation throughput (completion tokens / sec) when the provider reports it. */
  tokensPerSecond?: number;
}

/**
 * Minimal OpenRouter chat client.
 *
 * Mirrors the proven pattern from the user's "Curio" project: a small model
 * fallback list, JSON response format, reasoning excluded, and resilient error
 * handling (retry the next model on 4xx/5xx). Returns the raw assistant string;
 * callers parse + validate the JSON themselves (never trust model output blindly).
 */
export class OpenRouterClient implements JsonChatClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly models: string[];

  constructor(private readonly options: OpenRouterOptions) {
    this.models = uniqueStrings([
      options.model,
      'google/gemini-3.1-flash-lite',
      'google/gemini-3.1-flash-lite-preview',
    ]);
  }

  /** Models this client will try, in order. */
  get modelChain(): readonly string[] {
    return this.models;
  }

  /**
   * Run a JSON chat completion. Returns the assistant message content (expected
   * to be a JSON object string), or null if every model failed.
   *
   * Robustness: tries each model with `response_format: json_object` first; if a
   * model rejects that param (some Google models 4xx on it), it retries the same
   * model in "plain" mode. Real error bodies are logged so failures aren't silent.
   */
  async completeJson(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; online?: boolean; timeoutMs?: number } = {},
  ): Promise<string | null> {
    let lastError: string | null = null;

    for (const model of this.models) {
      let res = await this.callModel(model, messages, opts, 'json');
      // Retry the same model in plain mode when the structured request failed in a
      // way that's typically caused by `response_format: json_object`:
      //  - a 4xx (the model/route rejected the param), or
      //  - empty content, which the web-search (`:online`) plugin commonly returns
      //    under strict JSON mode — it answers with cited prose, not a JSON object.
      const rejectedJson = res.status && [400, 404, 415, 422, 501].includes(res.status);
      const emptyUnderJson = !res.ok && !res.status && res.error === 'empty content';
      if (!res.ok && (rejectedJson || emptyUnderJson)) {
        res = await this.callModel(model, messages, opts, 'plain');
      }
      if (res.ok && res.content) return res.content;
      lastError = `${model} → ${res.error ?? 'unknown error'}`;
      this.logger.warn(`OpenRouter model failed: ${lastError}`);
      // 401/403 = bad key/permissions: same for every model, so stop early.
      if (res.status === 401 || res.status === 403) break;
    }

    this.logger.error(`OpenRouter completion failed (all models). Last: ${lastError ?? 'unknown'}`);
    return null;
  }

  /**
   * Cheap connectivity/credential probe used by the AI health endpoint. Returns
   * the first model that responds, or an error string describing the failure.
   */
  async ping(): Promise<{ ok: boolean; model?: string; error?: string }> {
    let lastError: string | null = null;
    for (const model of this.models) {
      const res = await this.callModel(
        model,
        [{ role: 'user', content: 'ping' }],
        { temperature: 0, maxTokens: 5 },
        'plain',
      );
      if (res.ok) return { ok: true, model };
      lastError = `${model} → ${res.error ?? 'unknown error'}`;
      if (res.status === 401 || res.status === 403) break;
    }
    return { ok: false, error: lastError ?? 'unknown error' };
  }

  /**
   * Plain-text chat completion against the *primary* configured model (no JSON
   * constraint, no fallback chain). Returns the assistant text plus token usage
   * so the model playground can benchmark latency, cost and quality fairly.
   */
  async chat(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
  ): Promise<ChatTextResult> {
    const model = this.options.model;
    try {
      const response = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
          'HTTP-Referer': this.options.siteUrl ?? 'https://wudly.app',
          'X-Title': this.options.appTitle,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 800,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { ok: false, model, status: response.status, error: `HTTP ${response.status} ${truncate(text)}` };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const content = data?.choices?.[0]?.message?.content ?? '';
      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined;
      if (!content.trim()) return { ok: false, model, error: 'empty content', usage };
      return { ok: true, model, text: content, usage };
    } catch (err) {
      return { ok: false, model, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async callModel(
    model: string,
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; online?: boolean; timeoutMs?: number },
    mode: 'json' | 'plain',
  ): Promise<{ ok: boolean; content?: string; status?: number; error?: string }> {
    try {
      // `:online` enables OpenRouter's web-search plugin for live research.
      const body: Record<string, unknown> = {
        model: opts.online ? `${model}:online` : model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1200,
      };
      if (mode === 'json') {
        body.response_format = { type: 'json_object' };
        body.reasoning = { exclude: true };
      }

      const response = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
          'HTTP-Referer': this.options.siteUrl ?? 'https://wudly.app',
          'X-Title': this.options.appTitle,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { ok: false, status: response.status, error: `HTTP ${response.status} ${truncate(text)}` };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim().length > 0) return { ok: true, content };
      return { ok: false, error: 'empty content' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }
}

function truncate(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Parse a JSON object from a possibly fenced / noisy model response. */
export function parseJsonObject<T = Record<string, unknown>>(content: string | null): T | null {
  if (!content) return null;
  let text = content.trim();
  // Strip ```json … ``` fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  // Otherwise grab the outermost { … }.
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }
  return result;
}
