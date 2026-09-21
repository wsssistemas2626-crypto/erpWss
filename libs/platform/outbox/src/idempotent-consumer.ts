import { runInTenantContext, TenantDb, type TenantTransaction } from '@erp/platform-tenancy';
import type { EventEnvelope } from './event';

export type ConsumeOutcome = 'processed' | 'skipped';

/**
 * Base dos consumidores de evento (ADR-003).
 *
 * Entrega é pelo menos uma vez, então o mesmo evento pode chegar duas vezes. A marca de
 * processado é gravada **na mesma transação do efeito**: ou os dois existem, ou nenhum.
 * Tentar gravar a marca primeiro, com `on conflict do nothing`, faz o segundo consumidor
 * concorrente ver zero linhas afetadas e desistir sem aplicar nada.
 *
 * O efeito roda no tenant do evento, e não no de quem publicou: o worker não tem
 * requisição, então é daqui que o `TenantContext` nasce para ele.
 */
export abstract class IdempotentConsumer {
  constructor(private readonly tenantDb: TenantDb) {}

  /** Identificador estável do consumidor; entra na chave de idempotência. */
  abstract readonly name: string;

  /** Tipo de evento que este consumidor ouve. */
  abstract readonly eventType: string;

  protected abstract handle(tx: TenantTransaction, envelope: EventEnvelope): Promise<void>;

  async consume(envelope: EventEnvelope): Promise<ConsumeOutcome> {
    return runInTenantContext({ tenantId: envelope.tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const claimed = await tx.client.query(
          `insert into platform.processed_events (consumer_name, event_id, tenant_id)
           values ($1, $2, $3)
           on conflict (consumer_name, event_id) do nothing`,
          [this.name, envelope.id, envelope.tenantId],
        );

        if (claimed.rowCount === 0) {
          return 'skipped';
        }

        await this.handle(tx, envelope);
        return 'processed';
      }),
    );
  }
}
