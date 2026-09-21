import { ValidationError, type FieldIssue } from '@erp/shared-kernel';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ZodError, ZodType } from 'zod';

/**
 * Validação de entrada com o schema zod de `@erp/shared-contracts` (CLAUDE.md §5).
 *
 * Uso: `@Body(zodBody(createProjectSchema)) body: CreateProject`.
 * Falha vira `ValidationError`, que o `ProblemDetailsFilter` transforma em
 * 400 `application/problem+json` com a lista de campos inválidos.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new ValidationError(toFieldIssues(result.error));
  }
}

export function zodPipe<T>(schema: ZodType<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

export function toFieldIssues(error: ZodError): readonly FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
