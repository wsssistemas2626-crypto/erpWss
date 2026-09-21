import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de observabilidade da operação em curso.
 *
 * O `correlationId` existe antes de o tenant ser resolvido (ele é criado no primeiro
 * middleware), por isso não mora junto do `TenantContext`. O `tenantId` que vai para o
 * log é lido do contexto de tenancy na hora de logar (RNF033).
 */
export interface LogContext {
  readonly correlationId: string;
  readonly userId?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
