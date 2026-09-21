import Decimal from 'decimal.js';
import { DomainError } from '../domain-error';

/**
 * Instância própria do decimal.js (ADR-005).
 *
 * Clonar em vez de usar o `Decimal` global impede que qualquer dependência que mexa na
 * configuração global mude silenciosamente o resultado de um cálculo financeiro.
 * `toExpNeg`/`toExpPos` nos extremos garantem que nada vire notação científica ao virar string.
 */
export const Dec = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

export type Dec = InstanceType<typeof Dec>;

/** Meia-par: ABNT NBR 5891, o padrão do ADR-005. */
export const HALF_EVEN = Decimal.ROUND_HALF_EVEN;
const FLOOR = Decimal.ROUND_FLOOR;
export { FLOOR };

/** Casas decimais de cada grandeza, espelhando os tipos do banco (ADR-005). */
export const MONEY_SCALE = 4;
export const QUANTITY_SCALE = 6;
export const PERCENTAGE_SCALE = 4;

/** `numeric(19,4)` cabe 15 dígitos antes da vírgula; `numeric(19,6)`, 13. */
export const MONEY_MAX_INTEGER_DIGITS = 19 - MONEY_SCALE;
export const QUANTITY_MAX_INTEGER_DIGITS = 19 - QUANTITY_SCALE;
export const PERCENTAGE_MAX_INTEGER_DIGITS = 9 - PERCENTAGE_SCALE;

/**
 * Só aceita decimal literal. `1e3`, `Infinity`, `NaN` e espaços sobrando são recusados:
 * o valor quase sempre vem de JSON ou do banco, onde qualquer um deles é sintoma de bug.
 */
const DECIMAL_LITERAL = /^-?\d+(\.\d+)?$/;

export function parseDecimal(value: string, errorCode: string, label: string): Dec {
  if (typeof value !== 'string' || !DECIMAL_LITERAL.test(value)) {
    throw new DomainError(errorCode, `${label} inválido: "${String(value)}".`, { value });
  }
  return new Dec(value);
}

export function assertIntegerDigits(
  value: Dec,
  maxDigits: number,
  errorCode: string,
  label: string,
): void {
  const digits = value.trunc().abs().toFixed(0).length;
  if (digits > maxDigits) {
    throw new DomainError(
      errorCode,
      `${label} excede ${maxDigits} dígitos antes da vírgula: "${value.toString()}".`,
      { value: value.toString(), maxDigits },
    );
  }
}
