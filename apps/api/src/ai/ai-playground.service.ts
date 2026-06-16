import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiPlaygroundChatRequest,
  AiPlaygroundReply,
  AiPlaygroundTarget,
  AiPlaygroundTargetId,
} from '@wudly/shared';
import { OpenRouterClient, type ChatMessage, type ChatTextResult } from './openrouter.client';
import { OllamaClient } from './ollama.client';
import type { AppConfig } from '../config/configuration';

/**
 * Light system prompt so every target is compared under identical conditions —
 * the goal is to measure latency + answer quality, not prompt engineering.
 */
const SYSTEM_PROMPT =
  'Du bist Wudly, ein hilfreicher, ehrlicher Assistent. Antworte präzise, natürlich und ' +
  'in der Sprache des Nutzers (meist Deutsch). Erfinde keine Fakten.';

/**
 * Backs the admin model playground (`/api/ai/playground/*`).
 *
 * Unlike the {@link AI_SERVICE} provider (which is fixed at boot), this service
 * can call ALL configured targets on demand — the cloud model (Gemini Flash
 * Lite via OpenRouter) and BOTH self-hosted Gemma variants on Railway — so an
 * admin can benchmark responsiveness, cost and quality against each other.
 */
@Injectable()
export class AiPlaygroundService {
  private readonly logger = new Logger(AiPlaygroundService.name);
  private openRouter: OpenRouterClient | null = null;
  private gemma4b: OllamaClient | null = null;
  private gemma2b: OllamaClient | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /* ----- config getters ----- */

  private get openRouterKey(): string | undefined {
    return this.config.get('OPENROUTER_API_KEY', { infer: true });
  }

  private get openRouterModel(): string {
    return this.config.get('OPENROUTER_MODEL', { infer: true });
  }

  private get gemma4bUrl(): string {
    return this.config.get('OLLAMA_BASE_URL', { infer: true });
  }

  private get gemma4bModel(): string {
    return this.config.get('OLLAMA_MODEL', { infer: true });
  }

  /** The 2B service falls back to the 4B host when no separate URL is set. */
  private get gemma2bUrl(): string {
    return this.config.get('OLLAMA_2B_BASE_URL', { infer: true }) ?? this.gemma4bUrl;
  }

  private get gemma2bModel(): string {
    return this.config.get('OLLAMA_2B_MODEL', { infer: true });
  }

  /* ----- lazy clients ----- */

  private getOpenRouter(): OpenRouterClient | null {
    if (!this.openRouterKey) return null;
    if (!this.openRouter) {
      this.openRouter = new OpenRouterClient({
        apiKey: this.openRouterKey,
        model: this.openRouterModel,
        siteUrl: this.config.get('OPENROUTER_SITE_URL', { infer: true }),
        appTitle: this.config.get('OPENROUTER_APP_TITLE', { infer: true }),
      });
    }
    return this.openRouter;
  }

  private getGemma4b(): OllamaClient {
    if (!this.gemma4b) {
      this.gemma4b = new OllamaClient({ baseUrl: this.gemma4bUrl, model: this.gemma4bModel });
    }
    return this.gemma4b;
  }

  private getGemma2b(): OllamaClient {
    if (!this.gemma2b) {
      this.gemma2b = new OllamaClient({ baseUrl: this.gemma2bUrl, model: this.gemma2bModel });
    }
    return this.gemma2b;
  }

  /** Host part of a URL (for display), falling back to the raw value. */
  private hostOf(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  /** The three benchmarkable targets and whether each is configured. */
  listTargets(): AiPlaygroundTarget[] {
    const keyConfigured = Boolean(this.openRouterKey);
    const separate2b = Boolean(this.config.get('OLLAMA_2B_BASE_URL', { infer: true }));
    return [
      {
        id: 'openrouter',
        label: 'Gemini Flash Lite (Cloud)',
        provider: 'openrouter',
        model: this.openRouterModel,
        endpoint: 'openrouter.ai',
        configured: keyConfigured,
        kind: 'cloud',
        hint: keyConfigured ? undefined : 'OPENROUTER_API_KEY fehlt.',
      },
      {
        id: 'gemma-4b',
        label: 'Gemma 4B (Self-Hosted)',
        provider: 'ollama',
        model: this.gemma4bModel,
        endpoint: this.hostOf(this.gemma4bUrl),
        configured: true,
        kind: 'self-hosted',
      },
      {
        id: 'gemma-2b',
        label: 'Gemma 2B (Self-Hosted)',
        provider: 'ollama',
        model: this.gemma2bModel,
        endpoint: this.hostOf(this.gemma2bUrl),
        configured: true,
        kind: 'self-hosted',
        hint: separate2b ? undefined : 'Nutzt OLLAMA_BASE_URL (kein separater 2B-Host gesetzt).',
      },
    ];
  }

  /** Run one prompt against one target and return the answer + metrics. */
  async chat(req: AiPlaygroundChatRequest): Promise<AiPlaygroundReply> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const opts = { temperature: req.temperature, maxTokens: req.maxTokens };

    let provider: 'openrouter' | 'ollama' = 'ollama';
    let model = '';
    const started = Date.now();
    let result: ChatTextResult;

    switch (req.targetId) {
      case 'openrouter': {
        provider = 'openrouter';
        model = this.openRouterModel;
        const client = this.getOpenRouter();
        if (!client) {
          return this.fail(
            req.targetId,
            provider,
            model,
            'OPENROUTER_API_KEY ist nicht gesetzt — Cloud-Modell nicht konfiguriert.',
          );
        }
        result = await client.chat(messages, opts);
        break;
      }
      case 'gemma-4b': {
        model = this.gemma4bModel;
        result = await this.getGemma4b().chat(messages, opts);
        break;
      }
      case 'gemma-2b': {
        model = this.gemma2bModel;
        result = await this.getGemma2b().chat(messages, opts);
        break;
      }
      default:
        return this.fail(req.targetId, provider, model, `Unbekanntes Ziel: ${req.targetId}`);
    }

    const latencyMs = Date.now() - started;
    if (!result.ok) {
      this.logger.warn(`Playground ${req.targetId} (${result.model}) failed: ${result.error}`);
    }
    return {
      targetId: req.targetId,
      provider,
      model: result.model || model,
      ok: result.ok,
      text: result.text ?? '',
      error: result.ok ? undefined : this.explainError(provider, result.error, latencyMs),
      latencyMs,
      usage: result.usage,
      tokensPerSecond: result.tokensPerSecond,
    };
  }

  /**
   * Turn a raw client error into an actionable German hint for the admin UI —
   * the self-hosted Gemma failures (timeout/connection) are otherwise opaque.
   */
  private explainError(
    provider: 'openrouter' | 'ollama',
    raw: string | undefined,
    latencyMs: number,
  ): string {
    const msg = (raw ?? 'Unbekannter Fehler').trim();
    const lower = msg.toLowerCase();
    const isTimeout =
      lower.includes('aborted') || lower.includes('timeout') || lower.includes('timed out');
    const isConn =
      lower.includes('fetch failed') ||
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('eai_again') ||
      lower.includes('network') ||
      lower.includes('socket');
    const notFound = lower.includes('not found') || lower.includes('404');
    const secs = (latencyMs / 1000).toFixed(0);

    if (provider === 'ollama') {
      if (isTimeout) {
        return (
          `Zeitüberschreitung nach ${secs}s. Gemma läuft auf CPU (Cold Start ist langsam) ODER ` +
          `der Dienst ist nicht erreichbar. Prüfe: Lauscht Ollama auf IPv6 [::] (Railway Private ` +
          `Network)? Stimmt OLLAMA_BASE_URL? (${msg})`
        );
      }
      if (isConn) {
        return (
          `Verbindung zum Gemma-Dienst fehlgeschlagen. Prüfe OLLAMA_BASE_URL und ob der ` +
          `Service läuft (IPv6-Binding [::]). (${msg})`
        );
      }
      if (notFound) {
        return (
          `Modell nicht gefunden. Prüfe OLLAMA_MODEL (z. B. gemma4:e4b / gemma4:e2b) und ob es ` +
          `gepullt wurde. (${msg})`
        );
      }
      return msg;
    }

    if (isTimeout) return `Zeitüberschreitung nach ${secs}s. (${msg})`;
    return msg;
  }

  private fail(
    targetId: AiPlaygroundTargetId,
    provider: 'openrouter' | 'ollama',
    model: string,
    error: string,
  ): AiPlaygroundReply {
    return { targetId, provider, model, ok: false, text: '', error, latencyMs: 0 };
  }
}
