import { DomainError } from './domain-error';

/**
 * Erros de domínio que aparecem em todo módulo. Ficam aqui, e não na camada HTTP,
 * porque são fatos do domínio — o `code` é que é estável e traduzível; o mapeamento
 * para status HTTP é responsabilidade de `@erp/platform-http`.
 */

export const VALIDATION_ERROR = 'VALIDATION_ERROR';
export const ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND';
export const CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT';
export const UNAUTHENTICATED = 'UNAUTHENTICATED';
export const FORBIDDEN = 'FORBIDDEN';

export interface FieldIssue {
  /** Caminho do campo em notação de ponto: `items.0.quantity`. */
  readonly path: string;
  readonly message: string;
}

export class ValidationError extends DomainError {
  readonly issues: readonly FieldIssue[];

  constructor(issues: readonly FieldIssue[], message = 'Dados inválidos.') {
    super(VALIDATION_ERROR, message, { issues });
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(ENTITY_NOT_FOUND, `${entity} não encontrado: ${id}.`, { entity, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Controle de concorrência otimista (CLAUDE.md §5): o cliente mandou a versão que
 * tinha em mãos e ela já não é a versão corrente.
 */
export class ConcurrencyConflictError extends DomainError {
  constructor(entity: string, expectedVersion: number, currentVersion: number) {
    super(
      CONCURRENCY_CONFLICT,
      `${entity} foi alterado por outra pessoa: você enviou a versão ${String(expectedVersion)}, ` +
        `a atual é ${String(currentVersion)}.`,
      { entity, expectedVersion, currentVersion },
    );
    this.name = 'ConcurrencyConflictError';
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Autenticação necessária.') {
    super(UNAUTHENTICATED, message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso negado.', details: Readonly<Record<string, unknown>> = {}) {
    super(FORBIDDEN, message, details);
    this.name = 'ForbiddenError';
  }
}

/**
 * Compara a versão enviada pelo cliente com a versão corrente da entidade.
 * Lança `ConcurrencyConflictError` quando divergem — que a camada HTTP traduz em 409.
 */
export function assertVersion(entity: string, expected: number, current: number): void {
  if (expected !== current) {
    throw new ConcurrencyConflictError(entity, expected, current);
  }
}
