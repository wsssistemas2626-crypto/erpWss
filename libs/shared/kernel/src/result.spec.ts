import { describe, expect, it } from 'vitest';
import { DomainError } from './domain-error';
import { err, isErr, isOk, mapError, mapResult, ok, unwrap, unwrapOr } from './result';

describe('F0-04 Result', () => {
  it('distingue sucesso de falha', () => {
    const sucesso = ok(42);
    const falha = err(new DomainError('X_FAILED', 'falhou'));

    expect(isOk(sucesso)).toBe(true);
    expect(isErr(sucesso)).toBe(false);
    expect(isOk(falha)).toBe(false);
    expect(isErr(falha)).toBe(true);
  });

  it('mapeia o valor só no sucesso', () => {
    expect(mapResult(ok(2), (value) => value * 2)).toEqual({ ok: true, value: 4 });

    const falha = err(new DomainError('X_FAILED', 'falhou'));
    expect(mapResult(falha, (value: number) => value * 2)).toBe(falha);
  });

  it('mapeia o erro só na falha', () => {
    const sucesso = ok(2);
    expect(mapError(sucesso, () => 'outro')).toBe(sucesso);

    const mapeado = mapError(err('ruim'), (error) => `${error}!`);
    expect(mapeado).toEqual({ ok: false, error: 'ruim!' });
  });

  it('unwrap devolve o valor e lança o erro', () => {
    expect(unwrap(ok('valor'))).toBe('valor');
    expect(() => unwrap(err(new DomainError('X_FAILED', 'falhou')))).toThrow(DomainError);
  });

  it('unwrap embrulha erro que não é Error', () => {
    expect(() => unwrap(err('texto solto'))).toThrow(/texto solto/);
  });

  it('unwrapOr usa o padrão na falha', () => {
    expect(unwrapOr(ok('valor'), 'padrão')).toBe('valor');
    expect(unwrapOr(err(new DomainError('X_FAILED', 'falhou')), 'padrão')).toBe('padrão');
  });
});
