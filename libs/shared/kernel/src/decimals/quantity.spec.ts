import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain-error';
import { QUANTITY_INVALID_VALUE, QUANTITY_OUT_OF_RANGE, Quantity } from './quantity';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.code : `erro inesperado: ${String(error)}`;
  }
  return 'nenhum erro lançado';
}

describe('F0-04 Quantity', () => {
  it('guarda 6 casas, como o numeric(19,6) do banco', () => {
    expect(Quantity.of('1.5').toString()).toBe('1.500000');
    expect(Quantity.of('0.0000005').toString()).toBe('0.000000');
    expect(Quantity.of('0.0000015').toString()).toBe('0.000002');
  });

  it('soma sem erro de ponto flutuante', () => {
    expect(Quantity.of('0.1').plus(Quantity.of('0.2')).equals(Quantity.of('0.3'))).toBe(true);
    expect(Quantity.sum([Quantity.of('1.5'), Quantity.of('2.25')]).toFixed(2)).toBe('3.75');
  });

  it('multiplica, divide e recusa divisão por zero', () => {
    expect(Quantity.of('8').times('2.5').toFixed(2)).toBe('20.00');
    expect(Quantity.of('8').dividedBy(Quantity.of('2')).toFixed(2)).toBe('4.00');
    expect(codeOf(() => Quantity.of('8').dividedBy('0'))).toBe(QUANTITY_INVALID_VALUE);
  });

  it('arredonda meia-par', () => {
    expect(Quantity.of('2.345').round(2).toFixed(2)).toBe('2.34');
    expect(Quantity.of('2.355').round(2).toFixed(2)).toBe('2.36');
  });

  it('compara e classifica o sinal', () => {
    expect(Quantity.of('1').compare(Quantity.of('2'))).toBe(-1);
    expect(Quantity.zero().isZero()).toBe(true);
    expect(Quantity.of('1').isPositive()).toBe(true);
    expect(Quantity.of('-1').isNegative()).toBe(true);
    expect(Quantity.of('-1').abs().toFixed(0)).toBe('1');
    expect(Quantity.of('1').negated().toFixed(0)).toBe('-1');
  });

  it('recusa entrada inválida e valor fora da faixa', () => {
    expect(codeOf(() => Quantity.of('1e3'))).toBe(QUANTITY_INVALID_VALUE);
    expect(codeOf(() => Quantity.of('1,5'))).toBe(QUANTITY_INVALID_VALUE);
    expect(codeOf(() => Quantity.of('12345678901234'))).toBe(QUANTITY_OUT_OF_RANGE);
  });

  it('serializa como string', () => {
    expect(JSON.stringify({ hours: Quantity.of('7.5') })).toBe('{"hours":"7.500000"}');
  });
});
