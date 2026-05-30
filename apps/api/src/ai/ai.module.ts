import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_SERVICE, type AiService } from '@wudly/shared';
import { DummyAiService } from './dummy-ai.service';
import type { AppConfig } from '../config/configuration';

/**
 * Provides the {@link AiService} via the {@link AI_SERVICE} token. The concrete
 * implementation is selected from config (AI_PROVIDER). For the MVP only the
 * deterministic Dummy provider is wired; real adapters slot in here later.
 */
@Global()
@Module({
  providers: [
    DummyAiService,
    {
      provide: AI_SERVICE,
      inject: [ConfigService, DummyAiService],
      useFactory: (config: ConfigService<AppConfig, true>, dummy: DummyAiService): AiService => {
        const provider = config.get('AI_PROVIDER', { infer: true });
        switch (provider) {
          // case 'openai': return new OpenAiService(...);
          // case 'gemini': return new GeminiService(...);
          // case 'anthropic': return new AnthropicAiService(...);
          case 'dummy':
          default:
            return dummy;
        }
      },
    },
  ],
  exports: [AI_SERVICE],
})
export class AiModule {}
