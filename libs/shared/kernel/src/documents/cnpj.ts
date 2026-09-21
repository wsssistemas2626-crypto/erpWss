import { DomainError } from '../domain-error';
import { err, ok, type Result } from '../result';

export const CNPJ_INVALID = 'CNPJ_INVALID';

const CNPJ_LENGTH = 14;
const NON_DIGIT = /\D/g;
const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** Tira pontuação e espaços; não valida. */
export function normalizeCnpj(value: string): string {
  return String(value).replace(NON_DIGIT, '');
}

export function isValidCnpj(value: string): boolean {
  const digits = normalizeCnpj(value);

  if (digits.length !== CNPJ_LENGTH) {
    return false;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  const first = checkDigit(digits, FIRST_WEIGHTS);
  const second = checkDigit(digits, SECOND_WEIGHTS);

  return digits[12] === String(first) && digits[13] === String(second);
}

function checkDigit(digits: string, weights: readonly number[]): number {
  let sum = 0;
  for (let position = 0; position < weights.length; position += 1) {
    sum += Number(digits[position]) * Number(weights[position]);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** `"11.222.333/0001-81"` → `"11222333000181"`; inválido vira erro de domínio. */
export function parseCnpj(value: string): Result<string, DomainError> {
  const digits = normalizeCnpj(value);
  if (!isValidCnpj(digits)) {
    return err(new DomainError(CNPJ_INVALID, `CNPJ inválido: "${String(value)}".`, { value }));
  }
  return ok(digits);
}

/** `"11222333000181"` → `"11.222.333/0001-81"`. Só para exibição. */
export function formatCnpj(value: string): string {
  const digits = normalizeCnpj(value);
  if (digits.length !== CNPJ_LENGTH) {
    return value;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Os 8 primeiros dígitos: filiais da mesma empresa compartilham a raiz. */
export function cnpjRoot(value: string): string {
  return normalizeCnpj(value).slice(0, 8);
}
