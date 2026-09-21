/**
 * Superfície pública de @erp/platform-observability.
 * Logger pino com redação de dados sensíveis (RNF022) e contexto de correlação (RNF033).
 */
export { getCorrelationId, getLogContext, runWithLogContext, type LogContext } from './log-context';

export { createLogger, type CreateLoggerOptions, type LogLevel, type Logger } from './logger';

export { NestPinoLogger } from './nest-logger';

export { REDACTED, REDACT_PATHS, scrubSensitiveText } from './redaction';
