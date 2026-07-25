import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

/** Decorator to apply a per-route rate limit, e.g. @RateLimit({ limit: 5, windowMs: 60_000 }). */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * Multi-instance fixed-window limiter backed by an atomic PostgreSQL counter.
 * A small local counter keeps the API available during DB incidents. Only an
 * HMAC of IP + route is persisted, never the raw address.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly counters = new Map<string, Counter>();
  private lastFallbackWarningAt = 0;
  private requestsSinceCleanup = 0;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = this.buildKey(request, context);
    const response = context.switchToHttp().getResponse<Response>();
    try {
      const [bucket] = await this.prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>(
        Prisma.sql`
          INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt", "updatedAt")
          VALUES (
            ${key},
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + ${options.windowMs} * INTERVAL '1 millisecond',
            CURRENT_TIMESTAMP
          )
          ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE
              WHEN "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
              ELSE "RateLimitBucket"."count" + 1
            END,
            "windowStart" = CASE
              WHEN "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP
                THEN CURRENT_TIMESTAMP
              ELSE "RateLimitBucket"."windowStart"
            END,
            "expiresAt" = CASE
              WHEN "RateLimitBucket"."expiresAt" <= CURRENT_TIMESTAMP
                THEN CURRENT_TIMESTAMP + ${options.windowMs} * INTERVAL '1 millisecond'
              ELSE "RateLimitBucket"."expiresAt"
            END,
            "updatedAt" = CURRENT_TIMESTAMP
          RETURNING "count", "expiresAt"
        `,
      );
      if (bucket) {
        this.setHeaders(response, options.limit, bucket.count, bucket.expiresAt);
        this.cleanupExpiredBuckets();
        if (bucket.count > options.limit) this.reject(bucket.expiresAt, response);
        return true;
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.warnFallback(error);
    }
    const now = Date.now();

    const counter = this.counters.get(key);
    if (!counter || counter.resetAt <= now) {
      const resetAt = now + options.windowMs;
      this.counters.set(key, { count: 1, resetAt });
      this.setHeaders(response, options.limit, 1, new Date(resetAt));
      return true;
    }

    if (counter.count >= options.limit) {
      this.reject(new Date(counter.resetAt), response);
    }

    counter.count += 1;
    this.setHeaders(response, options.limit, counter.count, new Date(counter.resetAt));
    return true;
  }

  private buildKey(request: Request, context: ExecutionContext): string {
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const secret = process.env.JWT_SECRET ?? 'wudly-rate-limit-fallback';
    return createHmac('sha256', secret).update(`${ip}:${route}`).digest('hex');
  }
  private setHeaders(response: Response, limit: number, count: number, expiresAt: Date): void {
    response.setHeader('x-ratelimit-limit', String(limit));
    response.setHeader('x-ratelimit-remaining', String(Math.max(0, limit - count)));
    response.setHeader('x-ratelimit-reset', String(Math.ceil(expiresAt.getTime() / 1_000)));
  }

  private reject(expiresAt: Date, response: Response): never {
    const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1_000));
    response.setHeader('retry-after', String(retryAfter));
    throw new HttpException(
      {
        error: 'Too Many Requests',
        message: `Zu viele Anfragen. Bitte in ${retryAfter}s erneut versuchen.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private cleanupExpiredBuckets(): void {
    this.requestsSinceCleanup += 1;
    if (this.requestsSinceCleanup % 500 !== 0) return;
    void this.prisma.rateLimitBucket
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => undefined);
  }

  private warnFallback(error: unknown): void {
    const now = Date.now();
    if (now - this.lastFallbackWarningAt < 60_000) return;
    this.lastFallbackWarningAt = now;
    this.logger.warn(
      `Persistent rate limiter unavailable; using local fallback: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
