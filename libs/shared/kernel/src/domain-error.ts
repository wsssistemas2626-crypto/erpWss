/**
 * Erro de regra de domínio.
 *
 * O `code` é estável, em inglês e em SCREAMING_SNAKE_CASE: é ele que vai para o
 * `code` do problem+json (RFC 9457) e é por ele que o front escolhe a mensagem em pt-BR.
 * A `message` é para quem lê log, não para o usuário final.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
