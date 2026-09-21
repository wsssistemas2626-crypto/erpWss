import type { TenantTransaction } from '@erp/platform-tenancy';
import { DomainError, newId, type EntityId } from '@erp/shared-kernel';
import { EVENT_TYPE, type EventEnvelope } from './event';

export const EVENT_TYPE_INVALID = 'EVENT_TYPE_INVALID';

export interface OutboxEventInput {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Gravação do evento na mesma transação da alteração de negócio (ADR-003).
 *
 * Exigir a transação como primeiro argumento é o ponto inteiro do padrão: evento que
 * pudesse ser gravado fora dela voltaria a poder existir sem o fato que o originou — ou
 * sumir junto com um fato que aconteceu.
 */
export class OutboxWriter {
  async append(tx: TenantTransaction, input: OutboxEventInput): Promise<EntityId> {
    if (!EVENT_TYPE.test(input.type)) {
      throw new DomainError(
        EVENT_TYPE_INVALID,
        `Tipo de evento "${input.type}" fora do formato <modulo>.<entidade>.<fato>.v<N>.`,
        { type: input.type },
      );
    }

    const id = newId();
    await tx.client.query(
      `insert into platform.outbox_events (id, tenant_id, type, payload)
       values ($1, $2, $3, $4)`,
      [id, tx.tenantId, input.type, JSON.stringify(input.payload)],
    );
    return id;
  }

  /** Eventos ainda não publicados de um tenant. Usado em teste e diagnóstico. */
  async pendingOf(tx: TenantTransaction): Promise<readonly EventEnvelope[]> {
    const result = await tx.client.query<{
      id: string;
      tenant_id: string;
      type: string;
      payload: Record<string, unknown>;
      occurred_at: Date;
    }>(
      `select id, tenant_id, type, payload, occurred_at
         from platform.outbox_events
        where published_at is null
        order by occurred_at, id`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      payload: row.payload,
      occurredAt: row.occurred_at,
    }));
  }
}
