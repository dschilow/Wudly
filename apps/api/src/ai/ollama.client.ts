import { Logger } from '@nestjs/common';
import {
  parseJsonObject,
  type ChatMessage,
  type ChatTextResult,
  type JsonChatClient,
} from './openrouter.client';

export interface OllamaOptions {
  baseUrl: string;
  model: string;
}

/**
 * Small native client for an Ollama sidecar/service.
 *
 * Uses `/api/chat` instead of Ollama's OpenAI-compatible route so we can keep
 * thinking disabled, cap generation with `num_predict`, and keep models warm.
 */
export class OllamaClient implements JsonChatClient {
  private readonly logger = new Logger(OllamaClient.name);
  private readonly chatUrl: string;

  constructor(private readonly options: OllamaOptions) {
    const base = options.baseUrl.replace(/\/+$/, '');
    this.chatUrl = `${base}/api/chat`;
  }

  get modelChain(): readonly string[] {
    return [this.options.model];
  }

  async completeJson(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; online?: boolean; timeoutMs?: number } = {},
  ): Promise<string | null> {
    if (opts.online) {
      this.logger.warn('Ollama provider does not support live web search; using fallback');
      return null;
    }

    // Structured JSON constraints can be slow on CPU-backed Railway instances.
    // The prompts already require JSON, and callers validate the shape, so plain
    // mode is the pragmatic default.
    let res = await this.callModel(messages, opts, 'plain');
    if (!res.ok && res.status && [400, 404, 415, 422, 501].includes(res.status)) {
      res = await this.callModel(messages, opts, 'json');
    }
    if (res.ok && res.content) return res.content;

    this.logger.warn(`Ollama completion failed: ${res.error ?? 'unknown error'}`);
    return null;
  }

  async ping(): Promise<{ ok: boolean; model?: string; error?: string }> {
    const res = await this.callModel(
      [{ role: 'user', content: 'Return this JSON only: {"ok":true}' }],
      { temperature: 0, maxTokens: 12, timeoutMs: 20_000 },
      'plain',
    );
    if (!res.ok) return { ok: false, error: res.error ?? 'unknown error' };
    const parsed = parseJsonObject<{ ok?: boolean }>(res.content ?? null);
    return parsed?.ok ? { ok: true, model: this.options.model } : { ok: false, error: 'bad JSON probe' };
  }

  /**
   * Plain-text chat completion (no JSON constraint). Surfaces Ollama's timing
   * counters so the playground can show real generation throughput (tok/s).
   */
  async chat(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
  ): Promise<ChatTextResult> {
    const model = this.options.model;
    try {
      const response = await fetch(this.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: toOllamaMessages(messages),
          stream: false,
          think: false,
          keep_alive: '30m',
          options: {
            temperature: opts.temperature ?? 0.7,
            num_predict: opts.maxTokens ?? 800,
            num_ctx: 2048,
            top_k: 64,
            top_p: 0.95,
          },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { ok: false, model, status: response.status, error: `HTTP ${response.status} ${truncate(text)}` };
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        response?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        eval_duration?: number;
      };
      const content = data?.message?.content ?? data?.response ?? '';
      const usage =
        data.prompt_eval_count != null || data.eval_count != null
          ? {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count,
              totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            }
          : undefined;
      const tokensPerSecond =
        data.eval_count && data.eval_duration ? data.eval_count / (data.eval_duration / 1e9) : undefined;
      if (!content.trim()) return { ok: false, model, error: 'empty content', usage, tokensPerSecond };
      return { ok: true, model, text: content, usage, tokensPerSecond };
    } catch (err) {
      return { ok: false, model, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async callModel(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; timeoutMs?: number },
    mode: 'json' | 'plain',
  ): Promise<{ ok: boolean; content?: string; status?: number; error?: string }> {
    try {
      const body: Record<string, unknown> = {
        model: this.options.model,
        messages: toOllamaMessages(messages),
        stream: false,
        think: false,
        keep_alive: '30m',
        options: {
          temperature: opts.temperature ?? 0.4,
          num_predict: opts.maxTokens ?? 1200,
          num_ctx: 1024,
          top_k: 64,
          top_p: 0.95,
        },
      };
      if (mode === 'json') body.format = 'json';

      const response = await fetch(this.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { ok: false, status: response.status, error: `HTTP ${response.status} ${truncate(text)}` };
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        response?: string;
      };
      const content = data?.message?.content ?? data?.response;
      if (content && content.trim().length > 0) return { ok: true, content };
      return { ok: false, error: 'empty content' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

function toOllamaMessages(
  messages: ChatMessage[],
): Array<{ role: ChatMessage['role']; content: string; images?: string[] }> {
  return messages.map((message) => {
    if (typeof message.content === 'string') {
      return { role: message.role, content: message.content };
    }

    const text: string[] = [];
    const images: string[] = [];
    for (const part of message.content) {
      if (part.type === 'text') {
        text.push(part.text);
        continue;
      }

      const url = part.image_url.url;
      const comma = url.indexOf(',');
      if (url.startsWith('data:image/') && comma !== -1) {
        images.push(url.slice(comma + 1));
      }
    }

    return {
      role: message.role,
      content: text.join('\n\n') || 'Analysiere das Bild.',
      ...(images.length > 0 ? { images } : {}),
    };
  });
}

function truncate(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}
