import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type {
  AiPlaygroundChatRequest,
  AiPlaygroundPing,
  AiPlaygroundReply,
  AiPlaygroundTarget,
  AiPlaygroundTargetId,
} from '@wudly/shared';
import { AiPlaygroundService } from './ai-playground.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

const TARGET_IDS = ['openrouter', 'gemma-4b', 'gemma-2b'] as const;

const playgroundChatSchema = z.object({
  targetId: z.enum(TARGET_IDS),
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

const pingTargetSchema = z.enum(TARGET_IDS);

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

  /** Fast reachability probe for one target (Gemma: `/api/tags`, no inference). */
  @Get('ping')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  ping(
    @Query('target', new ZodValidationPipe(pingTargetSchema)) target: AiPlaygroundTargetId,
  ): Promise<AiPlaygroundPing> {
    return this.playground.ping(target);
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
