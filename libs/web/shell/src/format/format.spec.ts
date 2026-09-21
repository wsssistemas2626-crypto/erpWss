import { describe, expect, it } from 'vitest';
import {
  APP_TIME_ZONE,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
  formatPercentage,
  formatQuantity,
} from './format';

describe('F0-13 formatação brasileira', () => {
  it('formata Money "1234.5" BRL como R$ 1.234,50', () => {
    expect(formatMoney('1234.5')).toBe('R$ 1.234,50');
  });

  it('formata a data 2026-09-21T02:00:00Z como 20/09/2026 no fuso de São Paulo', () => {
    expect(APP_TIME_ZONE).toBe('America/Sao_Paulo');
    expect(formatDate('2026-09-21T02:00:00Z')).toBe('20/09/2026');
  });

  it('formata data e hora no fuso de São Paulo', () => {
    expect(formatDateTime('2026-09-21T02:00:00Z')).toBe('20/09/2026 23:00');
  });

  it('não muda o dia de uma data sem hora', () => {
    expect(formatDate('2026-09-21')).toBe('21/09/2026');
  });

  it('formata valor negativo e valor com quatro casas sem perder precisão', () => {
    expect(formatMoney('-0.0001')).toBe('-R$ 0,00');
    expect(formatMoney('12345678901234.5678')).toBe('R$ 12.345.678.901.234,57');
  });

  it('formata moeda estrangeira com o símbolo certo', () => {
    expect(formatMoney('1234.5', 'USD')).toBe('US$ 1.234,50');
  });

  it('formata horas com duas casas e a unidade', () => {
    expect(formatHours('7.5')).toBe('7,50 h');
    expect(formatHours('0')).toBe('0,00 h');
  });

  it('formata quantidade e percentual', () => {
    expect(formatQuantity('2.5')).toBe('2,5');
    expect(formatQuantity('1234.567')).toBe('1.234,567');
    expect(formatPercentage('12.5')).toBe('12,5%');
  });
});
