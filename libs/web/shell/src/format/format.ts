/**
 * Formatação brasileira do front (F0-13).
 *
 * Todo valor decimal chega da API como string (CLAUDE.md §4.3): nada aqui converte para
 * `number` — `Intl.NumberFormat` aceita a string decimal e formata sem perder precisão.
 * Datas chegam em UTC e são exibidas no fuso de São Paulo.
 */

export const APP_LOCALE = 'pt-BR';
export const APP_TIME_ZONE = 'America/Sao_Paulo';
export const DEFAULT_CURRENCY = 'BRL';

/** Casas decimais exibidas para quantidade de horas. */
const HOURS_FRACTION_DIGITS = 2;

/**
 * `Intl` formata a string decimal sem convertê-la para `number` — é o que preserva a
 * precisão exigida pelo ADR-005. O tipo `StringNumericLiteral` só aceita literais, então
 * o valor vindo da API precisa desta afirmação.
 */
function asNumeric(value: string): Intl.StringNumericLiteral {
  return value as Intl.StringNumericLiteral;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  const cached = moneyFormatters.get(currency);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(APP_LOCALE, { style: 'currency', currency });
  moneyFormatters.set(currency, formatter);
  return formatter;
}

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const hoursFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: HOURS_FRACTION_DIGITS,
  maximumFractionDigits: HOURS_FRACTION_DIGITS,
});

/**
 * `Intl` separa o símbolo com espaço fino inquebrável; trocar por espaço comum deixa o
 * texto igual ao que o usuário digitaria e torna as asserções de teste legíveis.
 */
function withPlainSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ');
}

/** `formatMoney('1234.5')` → `'R$ 1.234,50'`. */
export function formatMoney(amount: string, currency: string = DEFAULT_CURRENCY): string {
  return withPlainSpaces(moneyFormatter(currency).format(asNumeric(amount)));
}

/** Quantidade decimal, com as casas que o valor trouxer: `'2.5'` → `'2,5'`. */
export function formatQuantity(value: string): string {
  return withPlainSpaces(new Intl.NumberFormat(APP_LOCALE).format(asNumeric(value)));
}

/** Percentual como a API o envia (`'12.5'` = 12,5%) → `'12,5%'`. */
export function formatPercentage(value: string): string {
  return `${formatQuantity(value)}%`;
}

/** Horas apontadas: `'7.5'` → `'7,50 h'`. */
export function formatHours(hours: string): string {
  return `${withPlainSpaces(hoursFormatter.format(asNumeric(hours)))} h`;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Uma coluna `date` do banco (CLAUDE.md §5) chega como `2026-09-21`, sem hora nem fuso. */
const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Data em `dd/MM/yyyy`. Um `timestamptz` é convertido para o fuso de São Paulo; uma data
 * sem hora é apenas reordenada — convertê-la de fuso a jogaria para o dia anterior.
 */
export function formatDate(value: string | Date): string {
  if (typeof value === 'string') {
    const plain = PLAIN_DATE.exec(value);
    if (plain !== null) {
      return `${plain[3]}/${plain[2]}/${plain[1]}`;
    }
  }
  return withPlainSpaces(dateFormatter.format(toDate(value)));
}

/** Data e hora em `dd/MM/yyyy HH:mm`, no fuso de São Paulo. */
export function formatDateTime(value: string | Date): string {
  return withPlainSpaces(dateTimeFormatter.format(toDate(value))).replace(', ', ' ');
}
