/**
 * Superfície pública de @erp/platform-tenancy/testing.
 * Só para testes: prova o isolamento entre tenants de um repositório.
 */
export {
  assertTenantIsolation,
  type TenantIsolationOptions,
  type TenantIsolationSubject,
} from './assert-tenant-isolation';
