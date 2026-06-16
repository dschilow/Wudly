import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client';
import { OllamaClient } from './ollama.client';
import { resolveAiProvider, type AppConfig } from '../config/configuration';

export interface AiStatus {
  /** Effective provider after auto-resolution (key present ⇒ openrouter). */
  provider: 'openrouter' | 'ollama' | 'dummy';
  /** What AI_PROVIDER was literally set to (or "unset"). */
  configuredProvider: string;
  model: string;
  keyConfigured: boolean;
  modelChain: string[];
  /** Live probe result — only populated when `runLive` is requested. */
  live?: { ok: boolean; model?: string; error?: string; checkedAt: string };
  hint?: string;
}

/**
 * Reports the effective AI configuration and (on request) runs a cached live
 * probe against OpenRouter. Powers `GET /api/health/ai` so misconfiguration is
 * visible in production instead of silently falling back to the dummy provider.
 */
@Injectable()
export class AiHealthService {
  private readonly logger = new Logger(AiHealthService.name);
  private client: OpenRouterClient | null = null;
  private ollamaClient: OllamaClient | null = null;
  private liveCache: { result: NonNullable<AiStatus['live']>; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get key(): string | undefined {
    return this.config.get('OPENROUTER_API_KEY', { infer: true });
  }

  private get model(): string {
    return this.config.get('OPENROUTER_MODEL', { infer: true });
  }

  private get ollamaModel(): string {
    return this.config.get('OLLAMA_MODEL', { infer: true });
  }

  private getClient(): OpenRouterClient | null {
    if (!this.key) return null;
    if (!this.client) {
      this.client = new OpenRouterClient({
        apiKey: this.key,
        model: this.model,
        siteUrl: this.config.get('OPENROUTER_SITE_URL', { infer: true }),
        appTitle: this.config.get('OPENROUTER_APP_TITLE', { infer: true }),
      });
    }
    return this.client;
  }

  private getOllamaClient(): OllamaClient {
    if (!this.ollamaClient) {
      this.ollamaClient = new OllamaClient({
        baseUrl: this.config.get('OLLAMA_BASE_URL', { infer: true }),
        model: this.ollamaModel,
      });
    }
    return this.ollamaClient;
  }

  async status(runLive: boolean): Promise<AiStatus> {
    const provider = resolveAiProvider(process.env);
    const configuredProvider = process.env.AI_PROVIDER?.trim() || 'unset';
    const keyConfigured = Boolean(this.key);
    const client = provider === 'ollama' ? this.getOllamaClient() : this.getClient();

    const base: AiStatus = {
      provider,
      configuredProvider,
      model: provider === 'ollama' ? this.ollamaModel : this.model,
      keyConfigured: provider === 'openrouter' ? keyConfigured : false,
      modelChain: client ? [...client.modelChain] : [],
    };

    if (provider === 'ollama') {
      if (runLive && client) {
        const now = Date.now();
        if (!this.liveCache || this.liveCache.expiresAt <= now) {
          const probe = await client.ping();
          if (!probe.ok) this.logger.warn(`AI live probe failed: ${probe.error}`);
          this.liveCache = {
            result: { ...probe, checkedAt: new Date().toISOString() },
            expiresAt: now + 5 * 60_000,
          };
        }
        base.live = this.liveCache.result;
      }
      base.hint = base.live?.ok
        ? `KI aktiv über Ollama (${base.live.model}).`
        : 'KI ist auf Ollama konfiguriert. Nutze ?test=1 für einen Live-Test.';
      return base;
    }

    if (provider !== 'openrouter') {
      base.hint = keyConfigured
        ? `OPENROUTER_API_KEY ist gesetzt, aber AI_PROVIDER="${configuredProvider}". Setze AI_PROVIDER=openrouter.`
        : 'Kein OPENROUTER_API_KEY gesetzt — KI läuft im Dummy-Modus.';
      return base;
    }
    if (!keyConfigured) {
      base.hint = 'AI_PROVIDER=openrouter, aber OPENROUTER_API_KEY fehlt.';
      return base;
    }

    if (runLive && client) {
      const now = Date.now();
      if (!this.liveCache || this.liveCache.expiresAt <= now) {
        const probe = await client.ping();
        if (!probe.ok) this.logger.warn(`AI live probe failed: ${probe.error}`);
        this.liveCache = {
          result: { ...probe, checkedAt: new Date().toISOString() },
          expiresAt: now + 5 * 60_000,
        };
      }
      base.live = this.liveCache.result;
      base.hint = base.live.ok
        ? `KI aktiv über ${base.live.model}.`
        : `Live-Test fehlgeschlagen: ${base.live.error}`;
    }

    return base;
  }
}
