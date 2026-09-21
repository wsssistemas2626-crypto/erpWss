/**
 * Superfície pública de @erp/platform-tenancy.
 *
 * O contexto do tenant (AsyncLocalStorage) e o único caminho de acesso ao banco em
 * contexto de requisição (ADR-001). O utilitário de teste de isolamento fica em
 * `@erp/platform-tenancy/testing`, fora desta entrada.
 */
export {
  TENANT_CONTEXT_MISSING,
  getTenantContext,
  requireTenantId,
  runInTenantContext,
  type TenantContext,
} from './tenant-context';

export { TenantDb, type TenantTransaction } from './tenant-db';

export {
  TENANT_ID_SETTING,
  currentTenantId,
  tenantSettings,
  tenantStatus,
  tenants,
} from './infra/schema';
