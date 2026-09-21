import { describe, expect, it } from 'vitest';
import { DomainError, isDomainError } from './domain-error';

describe('F0-04 DomainError', () => {
  it('carrega um code estável e detalhes', () => {
    const error = new DomainError('SPRINT_ALREADY_CLOSED', 'A sprint já foi encerrada.', {
      sprintId: 'abc',
    });

    expect(error.code).toBe('SPRINT_ALREADY_CLOSED');
    expect(error.message).toBe('A sprint já foi encerrada.');
    expect(error.details).toEqual({ sprintId: 'abc' });
    expect(error.name).toBe('DomainError');
  });

  it('continua sendo um Error, com stack', () => {
    const error = new DomainError('X_FAILED', 'falhou');

    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
  });

  it('é reconhecível por isDomainError', () => {
    expect(isDomainError(new DomainError('X_FAILED', 'falhou'))).toBe(true);
    expect(isDomainError(new Error('comum'))).toBe(false);
    expect(isDomainError('texto')).toBe(false);
  });
});
