import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { parseCorsOrigins, type AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  // bodyParser disabled here so we can register parsers with a higher limit: the
  // camera-scan KI fallback POSTs a downscaled JPEG data URL, which exceeds the
  // 100kb Express default.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { limit: '2mb', extended: true });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  // Privacy-safe request correlation: no body, IP address or query values are logged.
  // Railway terminates TLS at one trusted proxy. This makes request.ip use the
  // actual client address for privacy-hashed abuse protection.
  app.set('trust proxy', 1);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.header('x-request-id');
    const requestId =
      incoming && /^[a-zA-Z0-9._-]{8,128}$/.test(incoming) ? incoming : randomUUID();
    const startedAt = performance.now();

    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      const durationMs = Math.round(performance.now() - startedAt);
      if (response.statusCode >= 500 || durationMs >= 2_000) {
        logger.warn(
          `[${requestId}] ${request.method} ${request.path} -> ${response.statusCode} in ${durationMs}ms`,
        );
      }
    });
    next();
  });

  // Security headers. Frontend is a separate origin, so CSP is left to the proxy/CDN.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());

  const corsOrigins = parseCorsOrigins(config.get('CORS_ORIGIN', { infer: true }));
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    exposedHeaders: [
      'x-request-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`Wudly API listening on http://0.0.0.0:${port}/api`);
  logger.log(`CORS allowed origins: ${corsOrigins.join(', ') || '*'}`);
}

void bootstrap();
