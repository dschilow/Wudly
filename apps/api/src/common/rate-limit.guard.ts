import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

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
 * Minimal fixed-window rate limiter backed by an in-memory map.
 *
 * Good enough for a single-instance MVP and intentionally simple. The interface
 * (key + window) maps cleanly onto Redis later for multi-instance deployments —
 * swap the Map for a Redis INCR/EXPIRE without touching call sites.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = this.buildKey(request, context);
    const now = Date.now();

    const counter = this.counters.get(key);
    if (!counter || counter.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (counter.count >= options.limit) {
      const retryAfter = Math.ceil((counter.resetAt - now) / 1000);
      throw new HttpException(
        {
          error: 'Too Many Requests',
          message: `Zu viele Anfragen. Bitte in ${retryAfter}s erneut versuchen.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    counter.count += 1;
    return true;
  }

  private buildKey(request: Request, context: ExecutionContext): string {
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    return `${ip}:${route}`;
  }
}
