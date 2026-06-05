import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiHealthService, type AiStatus } from '../ai/ai-health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiHealth: AiHealthService,
  ) {}

  /** Liveness + DB connectivity probe. Used by Railway health checks. */
  @Get()
  async check(): Promise<{ status: string; db: 'up' | 'down'; timestamp: string }> {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, timestamp: new Date().toISOString() };
  }

  /**
   * AI diagnostics. `GET /api/health/ai` shows the effective provider/model and
   * whether a key is configured (free). Add `?test=1` to run a cached live probe
   * against OpenRouter so you can see end-to-end whether the KI actually works.
   */
  @Get('ai')
  ai(@Query('test') test?: string): Promise<AiStatus> {
    return this.aiHealth.status(test === '1' || test === 'true');
  }
}
