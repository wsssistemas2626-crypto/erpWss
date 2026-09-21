import { getTenantContext } from '@erp/platform-tenancy';
import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { getLogContext } from './log-context';
import { REDACT_PATHS, REDACTED, scrubSensitiveText } from './redaction';

export type { Logger };

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface CreateLoggerOptions {
  readonly level: LogLevel;
  /** Vai no campo `name` de toda linha: `api`, `worker`. */
  readonly name: string;
  /** Destino alternativo — nos testes, um stream em memória. */
  readonly destination?: LoggerOptions['transport'] | NodeJS.WritableStream;
}

/**
 * Logger pino em JSON estruturado (CLAUDE.md §3).
 *
 * Toda linha carrega `correlationId` e `tenantId` quando existem (RNF033), e passa
 * pelas duas camadas de redação de `redaction.ts` (RNF022).
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const config: LoggerOptions = {
    name: options.name,
    level: options.level,
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    /** Acrescenta o contexto a cada linha, sem o chamador precisar lembrar. */
    mixin() {
      const log = getLogContext();
      const tenantId = getTenantContext()?.tenantId;
      return {
        ...(log?.correlationId === undefined ? {} : { correlationId: log.correlationId }),
        ...(log?.userId === undefined ? {} : { userId: log.userId }),
        ...(tenantId === undefined ? {} : { tenantId }),
      };
    },
    hooks: {
      logMethod(args, method) {
        const scrubbed = args.map((arg) =>
          typeof arg === 'string' ? scrubSensitiveText(arg) : arg,
        );
        method.apply(this, scrubbed as Parameters<typeof method>);
      },
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  const destination = options.destination;
  if (destination === undefined) {
    return pino(config);
  }
  if (typeof destination === 'object' && 'write' in destination) {
    return pino(config, destination as DestinationStream);
  }
  return pino({ ...config, transport: destination });
}
