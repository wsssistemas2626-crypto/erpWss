import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '../result';
import { CNPJ_INVALID, cnpjRoot, formatCnpj, isValidCnpj, normalizeCnpj, parseCnpj } from './cnpj';
import { CPF_INVALID, formatCpf, isValidCpf, normalizeCpf, parseCpf } from './cpf';

describe('F0-04 CNPJ', () => {
  it('aceita 11.222.333/0001-81 e normaliza para 11222333000181', () => {
    const parsed = parseCnpj('11.222.333/0001-81');

    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isOk(parsed) && parsed.value).toBe('11222333000181');
  });

  it('recusa 11.222.333/0001-80, de dígito verificador errado', () => {
    const parsed = parseCnpj('11.222.333/0001-80');

    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isErr(parsed) && parsed.error.code).toBe(CNPJ_INVALID);
  });

  it('recusa tamanho errado e dígitos todos iguais', () => {
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('112223330001811')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });

  it('normaliza, formata e extrai a raiz', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCnpj('123')).toBe('123');
    expect(cnpjRoot('11.222.333/0001-81')).toBe('11222333');
  });
});

describe('F0-04 CPF', () => {
  it('aceita um CPF válido e normaliza', () => {
    const parsed = parseCpf('529.982.247-25');

    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isOk(parsed) && parsed.value).toBe('52998224725');
  });

  it('recusa dígito verificador errado', () => {
    const parsed = parseCpf('529.982.247-26');

    expect(isValidCpf('529.982.247-26')).toBe(false);
    expect(isErr(parsed) && parsed.error.code).toBe(CPF_INVALID);
  });

  it('recusa tamanho errado e dígitos todos iguais', () => {
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('529982247255')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
  });

  it('normaliza e formata', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('123')).toBe('123');
  });
});
