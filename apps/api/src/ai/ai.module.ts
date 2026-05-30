import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_SERVICE, type AiService } from '@wudly/shared';
import { DummyAiService } from './dummy-ai.service';
import { OpenRouterAiService } from './openrouter-ai.service';
import { OpenRouterClient } from './openrouter.client';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';

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
    {
      provide: AI_SERVICE,
      inject: [ConfigService, DummyAiService, PrismaService],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        dummy: DummyAiService,
        prisma: PrismaService,
      ): AiService => {
        const logger = new Logger('AiModule');
        const provider = config.get('AI_PROVIDER', { infer: true });
        const apiKey = config.get('OPENROUTER_API_KEY', { infer: true });

        if (provider === 'openrouter') {
          if (!apiKey) {
            logger.warn('AI_PROVIDER=openrouter but OPENROUTER_API_KEY is missing → using dummy AI');
            return dummy;
          }
          const client = new OpenRouterClient({
            apiKey,
            model: config.get('OPENROUTER_MODEL', { infer: true }),
            siteUrl: config.get('OPENROUTER_SITE_URL', { infer: true }),
            appTitle: config.get('OPENROUTER_APP_TITLE', { infer: true }),
          });
          logger.log(`AI provider: OpenRouter (${config.get('OPENROUTER_MODEL', { infer: true })})`);
          return new OpenRouterAiService(client, dummy, prisma);
        }

        logger.log('AI provider: dummy (deterministic)');
        return dummy;
      },
    },
  ],
  exports: [AI_SERVICE],
})
export class AiModule {}
