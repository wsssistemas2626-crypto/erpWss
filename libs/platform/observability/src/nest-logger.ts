import type { LoggerService } from '@nestjs/common';
import type { Logger } from 'pino';

/**
 * Faz o log interno do NestJS sair pelo pino, em JSON (CLAUDE.md §3).
 *
 * Sem isso o processo emite dois formatos: JSON no log da aplicação e texto colorido
 * no log do framework — e o segundo escapa da redação e do `correlationId`.
 */
export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: unknown): void {
    this.logger.info(this.bind(context), String(message));
  }

  error(message: unknown, stack?: unknown, context?: unknown): void {
    this.logger.error(
      { ...this.bind(context), ...(stack === undefined ? {} : { stack: String(stack) }) },
      String(message),
    );
  }

  warn(message: unknown, context?: unknown): void {
    this.logger.warn(this.bind(context), String(message));
  }

  debug(message: unknown, context?: unknown): void {
    this.logger.debug(this.bind(context), String(message));
  }

  verbose(message: unknown, context?: unknown): void {
    this.logger.trace(this.bind(context), String(message));
  }

  fatal(message: unknown, context?: unknown): void {
    this.logger.fatal(this.bind(context), String(message));
  }

  private bind(context: unknown): Record<string, unknown> {
    return typeof context === 'string' ? { context } : {};
  }
}
