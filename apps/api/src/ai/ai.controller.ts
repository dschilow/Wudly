import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type {
  AiPlaygroundChatRequest,
  AiPlaygroundReply,
  AiPlaygroundTarget,
} from '@wudly/shared';
import { AiPlaygroundService } from './ai-playground.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

const playgroundChatSchema = z.object({
  targetId: z.enum(['openrouter', 'gemma-4b', 'gemma-2b']),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(16).max(2048).optional(),
});

/**
 * Admin-only model playground. Proxies a free-form prompt to a chosen model so
 * an admin can benchmark the cloud model against the self-hosted Gemma variants.
 *
 * Guarded by JWT + ADMIN role (so this never becomes an open, abusable LLM
 * proxy) and rate-limited per user.
 */
@Controller('ai/playground')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiController {
  constructor(private readonly playground: AiPlaygroundService) {}

  @Get('targets')
  targets(): AiPlaygroundTarget[] {
    return this.playground.listTargets();
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 40, windowMs: 60_000 })
  chat(
    @Body(new ZodValidationPipe(playgroundChatSchema)) body: AiPlaygroundChatRequest,
  ): Promise<AiPlaygroundReply> {
    return this.playground.chat(body);
  }
}
