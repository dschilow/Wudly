import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import type { AppConfig } from '../config/configuration';

/**
 * Provides {@link EmailService} app-wide. Real sending is disabled until
 * RESEND_API_KEY is set — see EmailService for the degrade behavior.
 */
@Global()
@Module({
  providers: [
    {
      provide: EmailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): EmailService => {
        const apiKey = (config.get('RESEND_API_KEY', { infer: true }) as string | undefined)?.trim() || null;
        const fromEmail = config.get('RESEND_FROM_EMAIL', { infer: true });
        return new EmailService(apiKey, fromEmail);
      },
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
