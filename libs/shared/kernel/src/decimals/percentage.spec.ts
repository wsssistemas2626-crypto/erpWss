import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain-error';
import { PERCENTAGE_INVALID_VALUE, PERCENTAGE_OUT_OF_RANGE, Percentage } from './percentage';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.code : `erro inesperado: ${String(error)}`;
  }
  return 'nenhum erro lançado';
}

describe('F0-04 Percentage', () => {
  it('guarda o número que o usuário lê, não a fração', () => {
    expect(Percentage.of('10.5').toString()).toBe('10.5000');
    expect(Percentage.of('10.5').asFraction().toFixed(4)).toBe('0.1050');
  });

  it('converte de fração', () => {
    expect(Percentage.fromFraction('0.105').toString()).toBe('10.5000');
    expect(Percentage.fromFraction('1').toString()).toBe('100.0000');
  });

  it('soma, subtrai e compara', () => {
    expect(Percentage.of('10').plus(Percentage.of('5.5')).toString()).toBe('15.5000');
    expect(Percentage.of('10').minus(Percentage.of('5.5')).toString()).toBe('4.5000');
    expect(Percentage.of('10').compare(Percentage.of('20'))).toBe(-1);
    expect(Percentage.of('10').equals(Percentage.of('10.0000'))).toBe(true);
    expect(Percentage.zero().isZero()).toBe(true);
  });

  it('recusa entrada inválida e valor fora da faixa', () => {
    expect(codeOf(() => Percentage.of('dez'))).toBe(PERCENTAGE_INVALID_VALUE);
    expect(codeOf(() => Percentage.of('123456'))).toBe(PERCENTAGE_OUT_OF_RANGE);
  });

  it('serializa como string', () => {
    expect(JSON.stringify({ allocation: Percentage.of('50') })).toBe('{"allocation":"50.0000"}');
  });
});
