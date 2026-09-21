import { getCorrelationId } from '@erp/platform-observability';
import { runInTenantContext, TenantDb, type TenantTransaction } from '@erp/platform-tenancy';
import { newId, type EntityId } from '@erp/shared-kernel';
import type { AuditRegistry } from './audit-registry';
import { maskPii } from './masking';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE';

export interface AuditEntry {
  readonly module: string;
  readonly entity: string;
  readonly entityId: EntityId;
  readonly action: AuditAction;
  /** Quem fez. Ausente em ação de sistema (worker, sincronização com o Clerk). */
  readonly userId?: EntityId;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
}

export interface AuditRecord extends AuditEntry {
  readonly id: EntityId;
  readonly occurredAt: Date;
  readonly correlationId: string | null;
}

export interface AuditQuery {
  readonly entity: string;
  readonly entityId: EntityId;
  readonly offset: number;
  readonly limit: number;
}

/**
 * Registro de auditoria (RNF030).
 *
 * `record` exige a transação do caso de uso como primeiro argumento, de propósito: se a
 * escrita de negócio desfizer, o registro de auditoria desfaz junto. Auditoria que sobrevive
 * a um rollback mente sobre o que aconteceu.
 *
 * O ator vem por parâmetro e não do `AuthContext` para esta lib não depender de
 * `platform/iam` — o inverso é que vale, porque o IAM audita as próprias mudanças de papel.
 */
export class AuditService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly registry: AuditRegistry,
  ) {}

  async record(tx: TenantTransaction, entry: AuditEntry): Promise<AuditRecord> {
    const piiFields = this.registry.piiFieldsOf(entry.module, entry.entity);
    const before = maskPii(entry.before, piiFields);
    const after = maskPii(entry.after, piiFields);
    const correlationId = getCorrelationId() ?? null;
    const id = newId();

    const result = await tx.client.query<{ occurred_at: Date }>(
      `insert into platform.audit_log
         (id, tenant_id, user_id, correlation_id, module, entity, entity_id, action, before, after)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning occurred_at`,
      [
        id,
        tx.tenantId,
        entry.userId ?? null,
        correlationId,
        entry.module,
        entry.entity,
        entry.entityId,
        entry.action,
        before === null ? null : JSON.stringify(before),
        after === null ? null : JSON.stringify(after),
      ],
    );

    return {
      ...entry,
      id,
      before,
      after,
      correlationId,
      occurredAt: result.rows[0]?.occurred_at ?? new Date(),
    };
  }

  async findByEntity(
    tenantId: EntityId,
    query: AuditQuery,
  ): Promise<{ items: readonly AuditRecord[]; total: number }> {
    return runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const total = await tx.client.query<{ count: string }>(
          'select count(*) as count from platform.audit_log where entity = $1 and entity_id = $2',
          [query.entity, query.entityId],
        );

        const rows = await tx.client.query<{
          id: string;
          occurred_at: Date;
          user_id: string | null;
          correlation_id: string | null;
          module: string;
          entity: string;
          entity_id: string;
          action: AuditAction;
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
        }>(
          `select id, occurred_at, user_id, correlation_id, module, entity, entity_id,
                  action, before, after
             from platform.audit_log
            where entity = $1 and entity_id = $2
            order by occurred_at desc, id desc
            limit $3 offset $4`,
          [query.entity, query.entityId, query.limit, query.offset],
        );

        return {
          items: rows.rows.map(toAuditRecord),
          total: Number(total.rows[0]?.count ?? '0'),
        };
      }),
    );
  }
}

function toAuditRecord(row: {
  id: string;
  occurred_at: Date;
  user_id: string | null;
  correlation_id: string | null;
  module: string;
  entity: string;
  entity_id: string;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}): AuditRecord {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    ...(row.user_id === null ? {} : { userId: row.user_id }),
    correlationId: row.correlation_id,
    module: row.module,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    before: row.before,
    after: row.after,
  };
}
