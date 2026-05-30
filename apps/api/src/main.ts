import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { parseCorsOrigins, type AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  // Security headers. Frontend is a separate origin, so CSP is left to the proxy/CDN.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());

  const corsOrigins = parseCorsOrigins(config.get('CORS_ORIGIN', { infer: true }));
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`Wudly API listening on http://0.0.0.0:${port}/api`);
  logger.log(`CORS allowed origins: ${corsOrigins.join(', ') || '*'}`);
}

void bootstrap();
