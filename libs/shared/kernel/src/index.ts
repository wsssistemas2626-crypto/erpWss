/**
 * Superfície pública de @erp/shared-kernel.
 *
 * Blocos de construção sem dependência de framework, banco ou HTTP: valores decimais
 * (ADR-005), identificadores, resultado explícito, erro de domínio, relógio injetável
 * e os documentos fiscais brasileiros.
 */
export { DomainError, isDomainError } from './domain-error';

export {
  CONCURRENCY_CONFLICT,
  ConcurrencyConflictError,
  ENTITY_NOT_FOUND,
  FORBIDDEN,
  ForbiddenError,
  NotFoundError,
  UNAUTHENTICATED,
  UnauthenticatedError,
  VALIDATION_ERROR,
  ValidationError,
  assertVersion,
  type FieldIssue,
} from './errors';

export {
  err,
  isErr,
  isOk,
  mapError,
  mapResult,
  ok,
  unwrap,
  unwrapOr,
  type Err,
  type Ok,
  type Result,
} from './result';

export { isEntityId, newId, type EntityId } from './ids';

export { FixedClock, SystemClock, type Clock } from './clock';

export { MONEY_SCALE, PERCENTAGE_SCALE, QUANTITY_SCALE, type Dec } from './decimals/decimal';

export {
  DEFAULT_CURRENCY,
  MONEY_CURRENCY_MISMATCH,
  MONEY_INVALID_AMOUNT,
  MONEY_INVALID_APPORTIONMENT,
  MONEY_INVALID_CURRENCY,
  MONEY_OUT_OF_RANGE,
  MONEY_PRESENTATION_SCALE,
  Money,
} from './decimals/money';

export { QUANTITY_INVALID_VALUE, QUANTITY_OUT_OF_RANGE, Quantity } from './decimals/quantity';

export {
  PERCENTAGE_INVALID_VALUE,
  PERCENTAGE_OUT_OF_RANGE,
  Percentage,
} from './decimals/percentage';

export { CPF_INVALID, formatCpf, isValidCpf, normalizeCpf, parseCpf } from './documents/cpf';

export {
  CNPJ_INVALID,
  cnpjRoot,
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
  parseCnpj,
} from './documents/cnpj';
