import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback for clients that don't render HTML. */
  text: string;
}

/**
 * Transactional email via Resend. Disabled (logs instead of sending) until
 * RESEND_API_KEY is set, so the app boots and every flow that sends email
 * (password reset, question-answered notice) stays fully testable without a
 * real provider — mirrors the AiService/BraveSearchService degrade pattern.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;

  constructor(
    apiKey: string | null,
    private readonly fromEmail: string,
  ) {
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Best-effort send — never throws, so a broken mail provider never breaks a request. */
  async send(input: SendEmailInput): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(
        `RESEND_API_KEY not set — email NOT sent (to=${input.to}, subject="${input.subject}")`,
      );
      return false;
    }
    try {
      const result = await this.client.emails.send({
        from: this.fromEmail,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      if (result.error) {
        this.logger.warn(`Resend rejected email to ${input.to}: ${result.error.message}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Email send failed (to=${input.to}): ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}
