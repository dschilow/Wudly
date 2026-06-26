import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiService } from '@wudly/shared';
import { BraveSearchService } from '../ai/brave-search.service';
import { DummyAiService } from '../ai/dummy-ai.service';
import { OllamaClient } from '../ai/ollama.client';
import { OpenRouterAiService } from '../ai/openrouter-ai.service';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

type GemmaResearchTargetId = 'gemma-4b' | 'gemma-2b';

interface GemmaResearchTarget {
  id: GemmaResearchTargetId;
  label: string;
  client: OllamaClient;
  ai: AiService;
}

const INITIAL_DELAY_MS = 2 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Periodically refreshes source-backed product ratings and public experience
 * themes using the self-hosted Gemma/Ollama services. Gemma has no native web
 * access, so this worker is intentionally enabled only when Brave Search can
 * provide current grounding snippets.
 */
@Injectable()
export class ProductResearchWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductResearchWorkerService.name);
  private readonly fallback = new DummyAiService();
  private targets: GemmaResearchTarget[] | null = null;
  private initial: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
    @Inject(ProductsService) private readonly products: ProductsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BraveSearchService) private readonly brave: BraveSearchService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (!this.enabled) return;

    if (!this.brave.enabled) {
      this.logger.warn(
        'Gemma product research worker is enabled, but BRAVE_SEARCH_KEY is missing. ' +
          'Self-hosted Ollama models cannot browse without Brave grounding; worker disabled.',
      );
      return;
    }

    const targets = this.getTargets();
    if (targets.length === 0) {
      this.logger.warn('Gemma product research worker has no valid target in PRODUCT_RESEARCH_WORKER_TARGETS.');
      return;
    }

    this.logger.log(
      `Gemma product research worker enabled: ${targets.map((t) => t.label).join(' -> ')}; ` +
        `batch=${this.batchSize}; stale>${this.maxAgeDays}d; interval=${this.intervalMinutes}m.`,
    );

    this.initial = setTimeout(() => {
      void this.runOnce();
      this.timer = setInterval(() => void this.runOnce(), this.intervalMinutes * MINUTE_MS);
    }, INITIAL_DELAY_MS);
  }

  onModuleDestroy(): void {
    if (this.initial) clearTimeout(this.initial);
    if (this.timer) clearInterval(this.timer);
  }

  /** One worker pass. Public so it can be exercised from tests or scripts later. */
  async runOnce(): Promise<void> {
    if (!this.enabled || this.running) return;
    if (!this.brave.enabled) return;

    const targets = this.getTargets();
    if (targets.length === 0) return;

    this.running = true;
    try {
      await this.preloadTargets(targets);
      const report = await this.products.backfillMissingRatings(this.batchSize, {
        aiServices: targets.map((target) => target.ai),
        maxAgeDays: this.maxAgeDays,
      });
      if (report.attempted === 0) {
        this.logger.log(`Gemma product research worker: nothing stale (remaining=${report.remaining}).`);
        return;
      }
      const themes = report.results.reduce((sum, row) => sum + row.themes, 0);
      this.logger.log(
        `Gemma product research worker: attempted=${report.attempted}, ` +
          `withRatings=${report.withRatings}, ratings=${report.totalFound}, ` +
          `themes=${themes}, remaining=${report.remaining}.`,
      );
    } catch (err) {
      this.logger.warn(
        `Gemma product research worker failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async preloadTargets(targets: GemmaResearchTarget[]): Promise<void> {
    if (!this.preloadEnabled) return;
    const results = await Promise.allSettled(
      targets.map((target) => target.client.preload(this.preloadTimeoutMs)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(`${targets[index]?.label ?? 'Gemma'} preload failed: ${result.reason}`);
        return;
      }
      if (!result.value.ok) {
        this.logger.warn(
          `${targets[index]?.label ?? 'Gemma'} preload failed: ${result.value.error ?? 'unknown error'}`,
        );
      }
    });
  }

  private getTargets(): GemmaResearchTarget[] {
    if (this.targets) return this.targets;

    this.targets = this.targetIds
      .map((id) => this.createTarget(id))
      .filter((target): target is GemmaResearchTarget => Boolean(target));
    return this.targets;
  }

  private createTarget(id: GemmaResearchTargetId): GemmaResearchTarget | null {
    const is2b = id === 'gemma-2b';
    const baseUrl = is2b ? this.gemma2bUrl : this.gemma4bUrl;
    const model = is2b ? this.gemma2bModel : this.gemma4bModel;
    if (!baseUrl || !model) return null;

    const client = new OllamaClient({ baseUrl, model });
    return {
      id,
      label: is2b ? `Gemma 2B (${model})` : `Gemma 4B (${model})`,
      client,
      ai: new OpenRouterAiService(client, this.fallback, this.prisma, this.brave, 'brave'),
    };
  }

  private get enabled(): boolean {
    return this.config.get('PRODUCT_RESEARCH_WORKER_ENABLED', { infer: true });
  }

  private get batchSize(): number {
    return this.config.get('PRODUCT_RESEARCH_WORKER_BATCH_SIZE', { infer: true });
  }

  private get intervalMinutes(): number {
    return this.config.get('PRODUCT_RESEARCH_WORKER_INTERVAL_MINUTES', { infer: true });
  }

  private get maxAgeDays(): number {
    return this.config.get('PRODUCT_RESEARCH_WORKER_MAX_AGE_DAYS', { infer: true });
  }

  private get preloadEnabled(): boolean {
    return this.config.get('PRODUCT_RESEARCH_WORKER_PRELOAD', { infer: true });
  }

  private get preloadTimeoutMs(): number {
    return this.config.get('PRODUCT_RESEARCH_WORKER_PRELOAD_TIMEOUT_MS', { infer: true });
  }

  private get targetIds(): GemmaResearchTargetId[] {
    return this.config.get('PRODUCT_RESEARCH_WORKER_TARGETS', { infer: true }) as GemmaResearchTargetId[];
  }

  private get gemma4bUrl(): string {
    return this.config.get('OLLAMA_BASE_URL', { infer: true });
  }

  private get gemma4bModel(): string {
    return this.config.get('OLLAMA_MODEL', { infer: true });
  }

  private get gemma2bUrl(): string {
    return this.config.get('OLLAMA_2B_BASE_URL', { infer: true }) ?? this.gemma4bUrl;
  }

  private get gemma2bModel(): string {
    return this.config.get('OLLAMA_2B_MODEL', { infer: true });
  }
}