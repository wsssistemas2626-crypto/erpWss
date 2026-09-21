import { describe, expect, it } from 'vitest';
import { DomainError } from './domain-error';
import {
  CONCURRENCY_CONFLICT,
  ConcurrencyConflictError,
  ENTITY_NOT_FOUND,
  FORBIDDEN,
  ForbiddenError,
  NotFoundError,
  UNAUTHENTICATED,
  UnauthenticatedError,
  VALIDATION_ERROR,
  ValidationError,
  assertVersion,
} from './errors';

describe('F0-06 erros padronizados', () => {
  it('cada erro carrega o seu code estável e continua sendo DomainError', () => {
    const erros = [
      [new ValidationError([{ path: 'name', message: 'obrigatório' }]), VALIDATION_ERROR],
      [new NotFoundError('Projeto', 'abc'), ENTITY_NOT_FOUND],
      [new ConcurrencyConflictError('Projeto', 2, 3), CONCURRENCY_CONFLICT],
      [new UnauthenticatedError(), UNAUTHENTICATED],
      [new ForbiddenError(), FORBIDDEN],
    ] as const;

    for (const [error, code] of erros) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe(code);
    }
  });

  it('ValidationError guarda a lista de campos inválidos', () => {
    const error = new ValidationError([
      { path: 'name', message: 'muito curto' },
      { path: 'items.0.quantity', message: 'precisa ser positivo' },
    ]);

    expect(error.issues.map((issue) => issue.path)).toEqual(['name', 'items.0.quantity']);
    expect(error.details).toEqual({ issues: error.issues });
  });

  it('ConcurrencyConflictError diz as duas versões', () => {
    const error = new ConcurrencyConflictError('Projeto', 2, 3);

    expect(error.details).toEqual({ entity: 'Projeto', expectedVersion: 2, currentVersion: 3 });
    expect(error.message).toContain('versão 2');
    expect(error.message).toContain('atual é 3');
  });

  it('assertVersion passa quando as versões batem e falha quando divergem', () => {
    expect(() => assertVersion('Projeto', 3, 3)).not.toThrow();
    expect(() => assertVersion('Projeto', 2, 3)).toThrow(ConcurrencyConflictError);
  });
});
