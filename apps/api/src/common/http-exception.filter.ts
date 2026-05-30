import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiErrorDto } from '@wudly/shared';

/**
 * Translates every thrown error into a consistent {@link ApiErrorDto} envelope.
 * Also maps the common Prisma errors to sensible HTTP status codes so callers
 * never see a raw 500 for an avoidable conflict (e.g. unique constraint).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.normalize(exception);

    if (status >= 500) {
      // Log full server errors (without request bodies to avoid leaking PII).
      this.logger.error(`${request.method} ${request.url} -> ${status}`, this.stack(exception));
    }

    const body: ApiErrorDto = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, error: exception.name, message: res };
      }
      const obj = res as { message?: string | string[]; error?: string };
      return {
        status,
        error: obj.error ?? exception.name,
        message: obj.message ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }

  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string | string[];
  } {
    switch (err.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Dieser Eintrag existiert bereits.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Der angeforderte Eintrag wurde nicht gefunden.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Ungültige Referenz.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Database Error',
          message: 'Ein Datenbankfehler ist aufgetreten.',
        };
    }
  }

  private stack(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.stack : undefined;
  }
}
