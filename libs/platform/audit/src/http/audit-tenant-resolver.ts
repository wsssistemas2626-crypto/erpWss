import type { EntityId } from '@erp/shared-kernel';

/**
 * De onde o controller de auditoria tira o tenant da requisição.
 *
 * É uma interface, e não uma chamada direta ao `AuthContext`, porque quem conhece o
 * `AuthContext` é `platform/iam` — e o IAM depende desta lib para auditar as próprias
 * mudanças de papel. A composição resolve: `apps/api` liga a interface ao IAM.
 */
export interface AuditTenantResolver {
  currentTenantId(): EntityId;
}

export const AUDIT_TENANT_RESOLVER = Symbol('AUDIT_TENANT_RESOLVER');
