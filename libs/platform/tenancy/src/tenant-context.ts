import { AsyncLocalStorage } from 'node:async_hooks';
import { DomainError, type EntityId } from '@erp/shared-kernel';

export const TENANT_CONTEXT_MISSING = 'TENANT_CONTEXT_MISSING';

/**
 * Contexto do tenant da operação em curso (ADR-001).
 *
 * O `tenantId` vem do token (API) ou do evento (worker) — **nunca** do corpo, da query
 * ou do path da requisição. Fica num AsyncLocalStorage para que nenhuma camada precise
 * passá-lo de mão em mão e, principalmente, para que ninguém consiga esquecê-lo:
 * sem contexto, `TenantDb` recusa abrir transação.
 */
export interface TenantContext {
  readonly tenantId: EntityId;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Roda `fn` com o tenant no contexto. Todo acesso a banco dentro dela o enxerga. */
export function runInTenantContext<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function requireTenantId(): EntityId {
  const context = storage.getStore();
  if (context === undefined) {
    throw new DomainError(
      TENANT_CONTEXT_MISSING,
      'Nenhum tenant no contexto: a operação não pode tocar o banco.',
    );
  }
  return context.tenantId;
}
