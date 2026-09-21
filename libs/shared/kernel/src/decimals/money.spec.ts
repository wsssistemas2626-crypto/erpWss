import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain-error';
import {
  DEFAULT_CURRENCY,
  MONEY_CURRENCY_MISMATCH,
  MONEY_INVALID_AMOUNT,
  MONEY_INVALID_APPORTIONMENT,
  MONEY_INVALID_CURRENCY,
  MONEY_OUT_OF_RANGE,
  Money,
} from './money';
import { Percentage } from './percentage';
import { Quantity } from './quantity';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.code : `erro inesperado: ${String(error)}`;
  }
  return 'nenhum erro lançado';
}

describe('F0-04 Money: soma', () => {
  it('soma sem erro de ponto flutuante', () => {
    const total = Money.of('0.10').plus(Money.of('0.20'));

    expect(total.equals(Money.of('0.30'))).toBe(true);
    expect(total.toString()).toBe('0.3000');
  });

  it('soma uma lista fechando o total', () => {
    const total = Money.sum([Money.of('0.10'), Money.of('0.20'), Money.of('0.30')]);

    expect(total.toFixed(2)).toBe('0.60');
  });

  it('subtrai e troca o sinal', () => {
    expect(Money.of('10.00').minus(Money.of('12.50')).toFixed(2)).toBe('-2.50');
    expect(Money.of('10.00').negated().isNegative()).toBe(true);
    expect(Money.of('-10.00').abs().toFixed(2)).toBe('10.00');
  });
});

describe('F0-04 Money: arredondamento meia-par', () => {
  it('arredonda 2.345 para 2.34 e 2.355 para 2.36', () => {
    expect(Money.of('2.345').round(2).toFixed(2)).toBe('2.34');
    expect(Money.of('2.355').round(2).toFixed(2)).toBe('2.36');
  });

  it('não arredonda para longe quando não há empate', () => {
    expect(Money.of('2.3449').round(2).toFixed(2)).toBe('2.34');
    expect(Money.of('2.3451').round(2).toFixed(2)).toBe('2.35');
  });

  it('guarda 4 casas, como o numeric(19,4) do banco', () => {
    expect(Money.of('1234.56').toString()).toBe('1234.5600');
    expect(Money.of('1.00005').toString()).toBe('1.0000');
    expect(Money.of('1.00015').toString()).toBe('1.0002');
  });
});

describe('F0-04 Money: rateio', () => {
  it('rateia 100.00 em 3 partes e a soma fecha', () => {
    const parts = Money.of('100.00').apportion(3);

    expect(parts.map((part) => part.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
    expect(Money.sum([...parts]).toFixed(2)).toBe('100.00');
  });

  it('rateia valor negativo fechando a soma', () => {
    const parts = Money.of('-100.00').apportion(3);

    expect(Money.sum([...parts]).toFixed(2)).toBe('-100.00');
  });

  it('rateia por pesos dando a sobra a quem tem o maior resto', () => {
    const parts = Money.of('100.00').apportionByWeights(['1', '1', '1']);

    expect(parts.map((part) => part.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
  });

  it('rateia proporcionalmente a pesos diferentes', () => {
    const parts = Money.of('1000.00').apportionByWeights(['50', '30', '20']);

    expect(parts.map((part) => part.toFixed(2))).toEqual(['500.00', '300.00', '200.00']);
    expect(Money.sum([...parts]).toFixed(2)).toBe('1000.00');
  });

  it('mantém a moeda em todas as partes', () => {
    const parts = Money.of('10.00', 'USD').apportion(3);

    expect(parts.map((part) => part.currency)).toEqual(['USD', 'USD', 'USD']);
  });

  it('recusa rateio sem partes ou com peso negativo', () => {
    expect(codeOf(() => Money.of('10.00').apportion(0))).toBe(MONEY_INVALID_APPORTIONMENT);
    expect(codeOf(() => Money.of('10.00').apportion(1.5))).toBe(MONEY_INVALID_APPORTIONMENT);
    expect(codeOf(() => Money.of('10.00').apportionByWeights([]))).toBe(
      MONEY_INVALID_APPORTIONMENT,
    );
    expect(codeOf(() => Money.of('10.00').apportionByWeights(['-1', '2']))).toBe(
      MONEY_INVALID_APPORTIONMENT,
    );
    expect(codeOf(() => Money.of('10.00').apportionByWeights(['0', '0']))).toBe(
      MONEY_INVALID_APPORTIONMENT,
    );
  });
});

describe('F0-04 Money: moedas', () => {
  it('usa BRL por padrão', () => {
    expect(Money.of('1.00').currency).toBe(DEFAULT_CURRENCY);
  });

  it('recusa somar moedas diferentes', () => {
    const brl = Money.of('10.00', 'BRL');
    const usd = Money.of('10.00', 'USD');

    expect(codeOf(() => brl.plus(usd))).toBe(MONEY_CURRENCY_MISMATCH);
    expect(codeOf(() => brl.minus(usd))).toBe(MONEY_CURRENCY_MISMATCH);
    expect(codeOf(() => brl.compare(usd))).toBe(MONEY_CURRENCY_MISMATCH);
  });

  it('considera moedas diferentes simplesmente diferentes, sem erro', () => {
    expect(Money.of('10.00', 'BRL').equals(Money.of('10.00', 'USD'))).toBe(false);
  });

  it('recusa código de moeda fora do ISO 4217', () => {
    expect(codeOf(() => Money.of('1.00', 'brl'))).toBe(MONEY_INVALID_CURRENCY);
    expect(codeOf(() => Money.of('1.00', 'REAL'))).toBe(MONEY_INVALID_CURRENCY);
  });
});

describe('F0-04 Money: entrada e saída', () => {
  it('recusa valor que não seja decimal literal', () => {
    expect(codeOf(() => Money.of('1e3'))).toBe(MONEY_INVALID_AMOUNT);
    expect(codeOf(() => Money.of('R$ 10,00'))).toBe(MONEY_INVALID_AMOUNT);
    expect(codeOf(() => Money.of(' 10.00 '))).toBe(MONEY_INVALID_AMOUNT);
    expect(codeOf(() => Money.of('NaN'))).toBe(MONEY_INVALID_AMOUNT);
  });

  it('recusa valor que não caberia em numeric(19,4)', () => {
    expect(codeOf(() => Money.of('1234567890123456'))).toBe(MONEY_OUT_OF_RANGE);
  });

  it('serializa como string, com a moeda junto', () => {
    expect(Money.of('1234.56').toJSON()).toEqual({ amount: '1234.5600', currency: 'BRL' });
    expect(JSON.stringify({ total: Money.of('1.5') })).toBe(
      '{"total":{"amount":"1.5000","currency":"BRL"}}',
    );
  });
});

describe('F0-04 Money: multiplicação e percentual', () => {
  it('multiplica por uma quantidade', () => {
    const total = Money.of('12.50').times(Quantity.of('3.5'));

    expect(total.toFixed(2)).toBe('43.75');
  });

  it('aplica um percentual', () => {
    expect(Money.of('200.00').applyPercentage(Percentage.of('10')).toFixed(2)).toBe('20.00');
    expect(Money.of('200.00').applyPercentage(Percentage.of('10.5')).toFixed(2)).toBe('21.00');
  });

  it('divide e recusa divisão por zero', () => {
    expect(Money.of('100.00').dividedBy('4').toFixed(2)).toBe('25.00');
    expect(codeOf(() => Money.of('100.00').dividedBy('0'))).toBe(MONEY_INVALID_AMOUNT);
  });
});

describe('F0-04 Money: comparação', () => {
  it('compara, ordena e classifica o sinal', () => {
    expect(Money.of('1.00').compare(Money.of('2.00'))).toBe(-1);
    expect(Money.of('2.00').compare(Money.of('1.00'))).toBe(1);
    expect(Money.of('1.00').compare(Money.of('1.00'))).toBe(0);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.of('0.01').isPositive()).toBe(true);
    expect(Money.of('-0.01').isNegative()).toBe(true);
  });
});
