import {
  Dec,
  HALF_EVEN,
  PERCENTAGE_MAX_INTEGER_DIGITS,
  PERCENTAGE_SCALE,
  assertIntegerDigits,
  parseDecimal,
} from './decimal';

export const PERCENTAGE_INVALID_VALUE = 'PERCENTAGE_INVALID_VALUE';
export const PERCENTAGE_OUT_OF_RANGE = 'PERCENTAGE_OUT_OF_RANGE';

const HUNDRED = new Dec(100);

/**
 * Percentual (ADR-005), guardado como o número que o usuário lê: `Percentage.of('10.5')`
 * é 10,5%, não 0,105. Imutável, 4 casas, como o `numeric(9,4)` do banco.
 */
export class Percentage {
  private readonly value: Dec;

  private constructor(value: Dec) {
    this.value = value;
  }

  static of(value: string): Percentage {
    const parsed = parseDecimal(value, PERCENTAGE_INVALID_VALUE, 'Percentual');
    assertIntegerDigits(
      parsed,
      PERCENTAGE_MAX_INTEGER_DIGITS,
      PERCENTAGE_OUT_OF_RANGE,
      'Percentual',
    );
    return new Percentage(parsed.toDecimalPlaces(PERCENTAGE_SCALE, HALF_EVEN));
  }

  /** `Percentage.fromFraction('0.105')` é 10,5%. */
  static fromFraction(fraction: string): Percentage {
    const parsed = parseDecimal(fraction, PERCENTAGE_INVALID_VALUE, 'Fração');
    return Percentage.of(parsed.times(HUNDRED).toFixed(PERCENTAGE_SCALE));
  }

  static zero(): Percentage {
    return Percentage.of('0');
  }

  /** 10,5% vira 0,105 — a forma usada para multiplicar. */
  asFraction(): Dec {
    return this.value.dividedBy(HUNDRED);
  }

  asDecimal(): Dec {
    return this.value;
  }

  plus(other: Percentage): Percentage {
    return Percentage.of(this.value.plus(other.value).toFixed(PERCENTAGE_SCALE));
  }

  minus(other: Percentage): Percentage {
    return Percentage.of(this.value.minus(other.value).toFixed(PERCENTAGE_SCALE));
  }

  compare(other: Percentage): number {
    return this.value.comparedTo(other.value);
  }

  equals(other: Percentage): boolean {
    return this.value.equals(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  toString(): string {
    return this.value.toFixed(PERCENTAGE_SCALE);
  }

  toFixed(scale: number): string {
    return this.value.toFixed(scale, HALF_EVEN);
  }

  toJSON(): string {
    return this.toString();
  }
}
