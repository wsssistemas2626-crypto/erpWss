import { DomainError } from '../domain-error';
import { err, ok, type Result } from '../result';

export const CPF_INVALID = 'CPF_INVALID';

const CPF_LENGTH = 11;
const NON_DIGIT = /\D/g;

/** Tira pontuação e espaços; não valida. */
export function normalizeCpf(value: string): string {
  return String(value).replace(NON_DIGIT, '');
}

export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);

  if (digits.length !== CPF_LENGTH) {
    return false;
  }

  // "111.111.111-11" e afins passam no módulo 11, mas não são CPF.
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  const first = checkDigit(digits, 9);
  const second = checkDigit(digits, 10);

  return digits[9] === String(first) && digits[10] === String(second);
}

/** Dígito verificador módulo 11 sobre os `length` primeiros dígitos. */
function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let position = 0; position < length; position += 1) {
    sum += Number(digits[position]) * (length + 1 - position);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

/** `"529.982.247-25"` → `"52998224725"`; inválido vira erro de domínio. */
export function parseCpf(value: string): Result<string, DomainError> {
  const digits = normalizeCpf(value);
  if (!isValidCpf(digits)) {
    return err(new DomainError(CPF_INVALID, `CPF inválido: "${String(value)}".`, { value }));
  }
  return ok(digits);
}

/** `"52998224725"` → `"529.982.247-25"`. Só para exibição. */
export function formatCpf(value: string): string {
  const digits = normalizeCpf(value);
  if (digits.length !== CPF_LENGTH) {
    return value;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
