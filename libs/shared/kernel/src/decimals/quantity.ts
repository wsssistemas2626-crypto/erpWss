import {
  Dec,
  HALF_EVEN,
  QUANTITY_MAX_INTEGER_DIGITS,
  QUANTITY_SCALE,
  assertIntegerDigits,
  parseDecimal,
} from './decimal';
import { DomainError } from '../domain-error';

export const QUANTITY_INVALID_VALUE = 'QUANTITY_INVALID_VALUE';
export const QUANTITY_OUT_OF_RANGE = 'QUANTITY_OUT_OF_RANGE';

/**
 * Quantidade fracionária (ADR-005): horas, peso, volume. Imutável.
 * Guardada com 6 casas, como o `numeric(19,6)` do banco.
 */
export class Quantity {
  private readonly value: Dec;

  private constructor(value: Dec) {
    this.value = value;
  }

  static of(value: string): Quantity {
    const parsed = parseDecimal(value, QUANTITY_INVALID_VALUE, 'Quantidade');
    assertIntegerDigits(parsed, QUANTITY_MAX_INTEGER_DIGITS, QUANTITY_OUT_OF_RANGE, 'Quantidade');
    return new Quantity(parsed.toDecimalPlaces(QUANTITY_SCALE, HALF_EVEN));
  }

  static zero(): Quantity {
    return Quantity.of('0');
  }

  static sum(values: readonly Quantity[]): Quantity {
    return values.reduce<Quantity>((total, value) => total.plus(value), Quantity.zero());
  }

  /** Uso interno do kernel: um Dec já validado vira Quantity sem repassar por string. */
  static fromDecimal(value: Dec): Quantity {
    assertIntegerDigits(value, QUANTITY_MAX_INTEGER_DIGITS, QUANTITY_OUT_OF_RANGE, 'Quantidade');
    return new Quantity(value.toDecimalPlaces(QUANTITY_SCALE, HALF_EVEN));
  }

  asDecimal(): Dec {
    return this.value;
  }

  plus(other: Quantity): Quantity {
    return Quantity.fromDecimal(this.value.plus(other.value));
  }

  minus(other: Quantity): Quantity {
    return Quantity.fromDecimal(this.value.minus(other.value));
  }

  times(multiplier: Quantity | string): Quantity {
    const factor =
      multiplier instanceof Quantity
        ? multiplier.value
        : parseDecimal(multiplier, QUANTITY_INVALID_VALUE, 'Multiplicador');
    return Quantity.fromDecimal(this.value.times(factor));
  }

  dividedBy(divisor: Quantity | string): Quantity {
    const factor =
      divisor instanceof Quantity
        ? divisor.value
        : parseDecimal(divisor, QUANTITY_INVALID_VALUE, 'Divisor');
    if (factor.isZero()) {
      throw new DomainError(QUANTITY_INVALID_VALUE, 'Divisão de quantidade por zero.');
    }
    return Quantity.fromDecimal(this.value.dividedBy(factor));
  }

  negated(): Quantity {
    return new Quantity(this.value.negated());
  }

  abs(): Quantity {
    return new Quantity(this.value.abs());
  }

  round(scale: number = QUANTITY_SCALE): Quantity {
    return new Quantity(this.value.toDecimalPlaces(scale, HALF_EVEN));
  }

  compare(other: Quantity): number {
    return this.value.comparedTo(other.value);
  }

  equals(other: Quantity): boolean {
    return this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.lessThan(0);
  }

  /** Forma canônica: 6 casas, como no banco e na API. */
  toString(): string {
    return this.value.toFixed(QUANTITY_SCALE);
  }

  toFixed(scale: number): string {
    return this.value.toFixed(scale, HALF_EVEN);
  }

  toJSON(): string {
    return this.toString();
  }
}
