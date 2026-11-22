import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ApiError } from '@watchlist/shared';
import { AuthErrorCode } from '@watchlist/shared';
import type { Response } from 'express';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: AuthErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: AuthErrorCode.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/**
 * Donne à toutes les erreurs HTTP la même forme ({@link ApiError}) avec un `code`
 * stable, pour que le front choisisse son message sans lire le texte anglais de Nest.
 * Un corps déjà structuré (sans `message`, comme celui de /api/health) est renvoyé tel quel.
 */
@Catch(HttpException)
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body = typeof raw === 'object' && raw !== null ? raw : {};

    if (!('message' in body) && !('code' in body) && Object.keys(body).length) {
      response.status(status).json(body);
      return;
    }

    const { code, message, issues } = body as Partial<ApiError>;
    const payload: ApiError = {
      statusCode: status,
      code: code ?? DEFAULT_CODES[status] ?? 'ERROR',
      message:
        typeof message === 'string'
          ? message
          : typeof raw === 'string'
            ? raw
            : exception.message,
      ...(issues ? { issues } : {}),
    };
    response.status(status).json(payload);
  }
}
