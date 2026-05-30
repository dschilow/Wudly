import { Logger } from '@nestjs/common';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  siteUrl?: string;
  appTitle: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Minimal OpenRouter chat client.
 *
 * Mirrors the proven pattern from the user's "Curio" project: a small model
 * fallback list, JSON response format, reasoning excluded, and resilient error
 * handling (retry the next model on 4xx/5xx). Returns the raw assistant string;
 * callers parse + validate the JSON themselves (never trust model output blindly).
 */
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly models: string[];

  constructor(private readonly options: OpenRouterOptions) {
    this.models = uniqueStrings([
      options.model,
      'google/gemini-3.1-flash-lite',
      'google/gemini-3.1-flash-lite-preview',
    ]);
  }

  /**
   * Run a JSON-mode chat completion. Returns the assistant message content
   * (expected to be a JSON object string), or null if every model failed.
   */
  async completeJson(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string | null> {
    let lastError: string | null = null;

    for (const model of this.models) {
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
            response_format: { type: 'json_object' },
            temperature: opts.temperature ?? 0.4,
            max_tokens: opts.maxTokens ?? 1200,
            reasoning: { exclude: true },
            include_reasoning: false,
          }),
          signal: AbortSignal.timeout(20_000),
        });

        if (!response.ok) {
          lastError = `OpenRouter ${response.status} for ${model}`;
          if ([400, 404, 408, 429, 500, 502, 503].includes(response.status)) continue;
          break;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (content && content.trim().length > 0) return content;
        lastError = `Empty content from ${model}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    this.logger.warn(`OpenRouter completion failed: ${lastError ?? 'unknown error'}`);
    return null;
  }
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
