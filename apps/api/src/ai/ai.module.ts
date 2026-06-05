import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_SERVICE, type AiService } from '@wudly/shared';
import { DummyAiService } from './dummy-ai.service';
import { OpenRouterAiService } from './openrouter-ai.service';
import { OpenRouterClient } from './openrouter.client';
import { AiHealthService } from './ai-health.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAiProvider, type AppConfig } from '../config/configuration';

/**
 * Provides the {@link AiService} via the {@link AI_SERVICE} token. The concrete
 * implementation is selected from config (AI_PROVIDER):
 *  - "openrouter" → real Gemini Flash via OpenRouter (falls back to dummy on errors)
 *  - "dummy" (default) → deterministic, dependency-free stub
 *
 * Real provider work happens behind the AiService interface, so business logic
 * never imports a provider directly.
 */
@Global()
@Module({
  providers: [
    DummyAiService,
    AiHealthService,
    {
      provide: AI_SERVICE,
      inject: [ConfigService, DummyAiService, PrismaService],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        dummy: DummyAiService,
        prisma: PrismaService,
      ): AiService => {
        const logger = new Logger('AiModule');
        // Effective provider: auto-enables OpenRouter when a key is present even
        // if AI_PROVIDER was never set (the common "key set, AI still dummy" trap).
        const provider = resolveAiProvider(process.env);
        const apiKey = config.get('OPENROUTER_API_KEY', { infer: true });
        const model = config.get('OPENROUTER_MODEL', { infer: true });

        if (provider === 'openrouter') {
          if (!apiKey) {
            logger.error('Provider openrouter but OPENROUTER_API_KEY is missing → using dummy AI');
            return dummy;
          }
          const client = new OpenRouterClient({
            apiKey,
            model,
            siteUrl: config.get('OPENROUTER_SITE_URL', { infer: true }),
            appTitle: config.get('OPENROUTER_APP_TITLE', { infer: true }),
          });
          const autoNote = process.env.AI_PROVIDER?.trim() ? '' : ' [auto-enabled: key present]';
          logger.log(`AI provider: OpenRouter (model=${model})${autoNote}`);
          return new OpenRouterAiService(client, dummy, prisma);
        }

        if (apiKey) {
          logger.warn(
            `OPENROUTER_API_KEY is set but AI_PROVIDER="${process.env.AI_PROVIDER}" → AI disabled. ` +
              'Set AI_PROVIDER=openrouter to enable.',
          );
        }
        logger.log('AI provider: dummy (deterministic)');
        return dummy;
      },
    },
  ],
  exports: [AI_SERVICE, AiHealthService],
})
export class AiModule {}
