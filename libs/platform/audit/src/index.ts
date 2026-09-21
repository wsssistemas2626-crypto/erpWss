/**
 * Superfície pública de @erp/platform-audit.
 * Registro imutável de quem mudou o quê, quando e em qual tenant (RNF030 a RNF033).
 */
export {
  AUDIT_REGISTRY,
  AuditRegistry,
  DEFAULT_PII_FIELDS,
  type AuditedEntityDefinition,
} from './audit-registry';

export {
  AuditService,
  type AuditAction,
  type AuditEntry,
  type AuditQuery,
  type AuditRecord,
} from './audit-service';

export { PII_PREFIX, maskPii, maskValue } from './masking';

export { AUDIT_PERMISSIONS } from './audit-permissions';

export { AuditController } from './http/audit.controller';
export { AUDIT_TENANT_RESOLVER, type AuditTenantResolver } from './http/audit-tenant-resolver';
