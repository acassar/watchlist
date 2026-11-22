import { BadRequestException, PipeTransform } from '@nestjs/common';
import { AuthErrorCode } from '@watchlist/shared';
import type { ZodType } from 'zod';

/**
 * Valide un corps de requête avec un schéma Zod partagé (packages/shared).
 * Renvoie 400 avec la liste des champs fautifs (messages = clés i18n).
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      code: AuthErrorCode.VALIDATION_ERROR,
      message: 'Requête invalide',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
