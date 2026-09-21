import {
  Dec,
  FLOOR,
  HALF_EVEN,
  MONEY_MAX_INTEGER_DIGITS,
  MONEY_SCALE,
  assertIntegerDigits,
  parseDecimal,
} from './decimal';
import { DomainError } from '../domain-error';
import { Percentage } from './percentage';
import { Quantity } from './quantity';

export const MONEY_INVALID_AMOUNT = 'MONEY_INVALID_AMOUNT';
export const MONEY_INVALID_CURRENCY = 'MONEY_INVALID_CURRENCY';
export const MONEY_CURRENCY_MISMATCH = 'MONEY_CURRENCY_MISMATCH';
export const MONEY_OUT_OF_RANGE = 'MONEY_OUT_OF_RANGE';
export const MONEY_INVALID_APPORTIONMENT = 'MONEY_INVALID_APPORTIONMENT';

export const DEFAULT_CURRENCY = 'BRL';

/** Casas usadas ao apresentar e ao ratear: centavos. O cálculo interno continua em 4. */
export const MONEY_PRESENTATION_SCALE = 2;

const CURRENCY_CODE = /^[A-Z]{3}$/;
const ZERO = new Dec(0);
const ONE = new Dec(1);
const TEN = new Dec(10);

/**
 * Valor monetário (ADR-005): quantia + moeda, imutável, sobre decimal.js.
 *
 * É uma classe com estado privado de propósito: isso a torna nominal em TypeScript, então
 * `number` não entra onde se espera `Money`. Guardada com 4 casas, como o `numeric(19,4)`
 * do banco; o arredondamento para 2 casas é explícito (`round`) e meia-par.
 */
export class Money {
  private readonly amount: Dec;
  readonly currency: string;

  private constructor(amount: Dec, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  static of(amount: string, currency: string = DEFAULT_CURRENCY): Money {
    const code = Money.assertCurrency(currency);
    const parsed = parseDecimal(amount, MONEY_INVALID_AMOUNT, 'Valor monetário');
    assertIntegerDigits(parsed, MONEY_MAX_INTEGER_DIGITS, MONEY_OUT_OF_RANGE, 'Valor monetário');
    return new Money(parsed.toDecimalPlaces(MONEY_SCALE, HALF_EVEN), code);
  }

  static zero(currency: string = DEFAULT_CURRENCY): Money {
    return Money.of('0', currency);
  }

  static sum(values: readonly Money[], currency: string = DEFAULT_CURRENCY): Money {
    return values.reduce<Money>((total, value) => total.plus(value), Money.zero(currency));
  }

  private static fromDecimal(amount: Dec, currency: string): Money {
    assertIntegerDigits(amount, MONEY_MAX_INTEGER_DIGITS, MONEY_OUT_OF_RANGE, 'Valor monetário');
    return new Money(amount.toDecimalPlaces(MONEY_SCALE, HALF_EVEN), currency);
  }

  private static assertCurrency(currency: string): string {
    if (typeof currency !== 'string' || !CURRENCY_CODE.test(currency)) {
      throw new DomainError(
        MONEY_INVALID_CURRENCY,
        `Moeda inválida: "${String(currency)}". Use o código ISO 4217 com três letras maiúsculas.`,
        { currency },
      );
    }
    return currency;
  }

  private assertSameCurrency(other: Money, operation: string): void {
    if (this.currency !== other.currency) {
      throw new DomainError(
        MONEY_CURRENCY_MISMATCH,
        `Não é possível ${operation} valores em moedas diferentes: ${this.currency} e ${other.currency}.`,
        { left: this.currency, right: other.currency },
      );
    }
  }

  asDecimal(): Dec {
    return this.amount;
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other, 'somar');
    return Money.fromDecimal(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other, 'subtrair');
    return Money.fromDecimal(this.amount.minus(other.amount), this.currency);
  }

  times(multiplier: Quantity | string): Money {
    const factor =
      multiplier instanceof Quantity
        ? multiplier.asDecimal()
        : parseDecimal(multiplier, MONEY_INVALID_AMOUNT, 'Multiplicador');
    return Money.fromDecimal(this.amount.times(factor), this.currency);
  }

  dividedBy(divisor: Quantity | string): Money {
    const factor =
      divisor instanceof Quantity
        ? divisor.asDecimal()
        : parseDecimal(divisor, MONEY_INVALID_AMOUNT, 'Divisor');
    if (factor.isZero()) {
      throw new DomainError(MONEY_INVALID_AMOUNT, 'Divisão de valor monetário por zero.');
    }
    return Money.fromDecimal(this.amount.dividedBy(factor), this.currency);
  }

  /** `Money.of('200').applyPercentage(Percentage.of('10'))` é 20,00. */
  applyPercentage(percentage: Percentage): Money {
    return Money.fromDecimal(this.amount.times(percentage.asFraction()), this.currency);
  }

  negated(): Money {
    return new Money(this.amount.negated(), this.currency);
  }

  abs(): Money {
    return new Money(this.amount.abs(), this.currency);
  }

  /** Arredondamento meia-par (ADR-005). Padrão: centavos. */
  round(scale: number = MONEY_PRESENTATION_SCALE): Money {
    return new Money(this.amount.toDecimalPlaces(scale, HALF_EVEN), this.currency);
  }

  /**
   * Rateio em partes iguais, com algoritmo de maior resto: a soma das partes é
   * exatamente o valor original, sem centavo sobrando nem faltando (ADR-005).
   */
  apportion(parts: number, scale: number = MONEY_PRESENTATION_SCALE): readonly Money[] {
    if (!Number.isInteger(parts) || parts < 1) {
      throw new DomainError(
        MONEY_INVALID_APPORTIONMENT,
        `O número de partes do rateio precisa ser um inteiro positivo, e não ${String(parts)}.`,
        { parts },
      );
    }
    return this.apportionByWeights(new Array<string>(parts).fill('1'), scale);
  }

  /** Rateio proporcional a pesos (ex.: dividir custo entre centros de custo). */
  apportionByWeights(
    weights: readonly string[],
    scale: number = MONEY_PRESENTATION_SCALE,
  ): readonly Money[] {
    if (weights.length === 0) {
      throw new DomainError(MONEY_INVALID_APPORTIONMENT, 'O rateio precisa de ao menos um peso.');
    }

    const parsedWeights = weights.map((weight) =>
      parseDecimal(weight, MONEY_INVALID_APPORTIONMENT, 'Peso do rateio'),
    );

    if (parsedWeights.some((weight) => weight.lessThan(ZERO))) {
      throw new DomainError(MONEY_INVALID_APPORTIONMENT, 'Peso de rateio não pode ser negativo.', {
        weights,
      });
    }

    const totalWeight = parsedWeights.reduce((total, weight) => total.plus(weight), ZERO);
    if (totalWeight.isZero()) {
      throw new DomainError(
        MONEY_INVALID_APPORTIONMENT,
        'A soma dos pesos do rateio não pode ser zero.',
        { weights },
      );
    }

    const unit = TEN.pow(-scale);
    const totalUnits = this.amount
      .toDecimalPlaces(scale, HALF_EVEN)
      .dividedBy(unit)
      .toDecimalPlaces(0, HALF_EVEN);

    // Piso de cada parte e a fração que sobrou dela: o maior resto leva a unidade extra.
    const shares = parsedWeights.map((weight, index) => {
      const exact = totalUnits.times(weight).dividedBy(totalWeight);
      const units = exact.toDecimalPlaces(0, FLOOR);
      return { index, units, remainder: exact.minus(units) };
    });

    const distributed = shares.reduce((total, share) => total.plus(share.units), ZERO);
    let leftover = totalUnits.minus(distributed);

    const byLargestRemainder = [...shares].sort((left, right) => {
      const comparison = right.remainder.comparedTo(left.remainder);
      return comparison !== 0 ? comparison : left.index - right.index;
    });

    for (const share of byLargestRemainder) {
      if (leftover.lessThanOrEqualTo(ZERO)) {
        break;
      }
      share.units = share.units.plus(ONE);
      leftover = leftover.minus(ONE);
    }

    return shares.map((share) => new Money(share.units.times(unit), this.currency));
  }

  compare(other: Money): number {
    this.assertSameCurrency(other, 'comparar');
    return this.amount.comparedTo(other.amount);
  }

  /** Moedas diferentes são simplesmente diferentes — comparar por igualdade não é erro. */
  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isPositive(): boolean {
    return this.amount.greaterThan(ZERO);
  }

  isNegative(): boolean {
    return this.amount.lessThan(ZERO);
  }

  /** Forma canônica: 4 casas, como no banco e na API (`"1234.5600"`). */
  toString(): string {
    return this.amount.toFixed(MONEY_SCALE);
  }

  toFixed(scale: number): string {
    return this.amount.toFixed(scale, HALF_EVEN);
  }

  toJSON(): { readonly amount: string; readonly currency: string } {
    return { amount: this.toString(), currency: this.currency };
  }
}
