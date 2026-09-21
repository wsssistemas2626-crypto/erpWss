import type { Logger } from '@erp/platform-observability';
import type { EntityId } from '@erp/shared-kernel';
import type { Pool } from 'pg';
import type { EventBus, EventEnvelope } from './event';

/** ADR-003: depois de 10 falhas o evento vai para dead-letter. */
export const MAX_PUBLISH_ATTEMPTS = 10;
const BACKOFF_BASE_SECONDS = 2;
const BACKOFF_CAP_SECONDS = 3600;

export interface OutboxPublisherOptions {
  readonly batchSize?: number;
  readonly maxAttempts?: number;
  readonly pollIntervalMs?: number;
}

export interface PublishBatchResult {
  readonly published: number;
  readonly failed: number;
  readonly deadLettered: readonly EntityId[];
}

interface PendingRow {
  id: string;
  tenant_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
}

/**
 * Drena a outbox para o bus (ADR-003).
 *
 * Conecta como `app_platform`, a role que o ADR-001 reserva para rotinas que atravessam
 * tenants — a outbox é exatamente isso. `FOR UPDATE SKIP LOCKED` permite mais de uma
 * instância do worker sem que o mesmo evento seja publicado duas vezes em paralelo.
 *
 * A entrega é **pelo menos uma vez**: o `published_at` é gravado depois da publicação, então
 * uma queda entre as duas coisas republica o evento. Quem garante o "exatamente uma vez"
 * do efeito é o `IdempotentConsumer`.
 */
export class OutboxPublisher {
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly pool: Pool,
    private readonly bus: EventBus,
    private readonly logger: Logger,
    options: OutboxPublisherOptions = {},
  ) {
    this.batchSize = options.batchSize ?? 50;
    this.maxAttempts = options.maxAttempts ?? MAX_PUBLISH_ATTEMPTS;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
  }

  async publishBatch(): Promise<PublishBatchResult> {
    const client = await this.pool.connect();
    const deadLettered: EntityId[] = [];
    let published = 0;
    let failed = 0;

    try {
      await client.query('BEGIN');
      const pending = await client.query<PendingRow>(
        `select id, tenant_id, type, payload, occurred_at, attempts
           from platform.outbox_events
          where published_at is null
            and dead_lettered_at is null
            and next_attempt_at <= now()
          order by occurred_at, id
          limit $1
          for update skip locked`,
        [this.batchSize],
      );

      for (const row of pending.rows) {
        const envelope = toEnvelope(row);
        try {
          await this.bus.publish(envelope);
          await client.query(
            'update platform.outbox_events set published_at = now(), last_error = null where id = $1',
            [row.id],
          );
          published += 1;
        } catch (error) {
          failed += 1;
          const attempts = row.attempts + 1;
          const isDead = attempts >= this.maxAttempts;
          if (isDead) {
            deadLettered.push(row.id);
          }

          await client.query(
            `update platform.outbox_events
                set attempts = $2,
                    last_error = $3,
                    next_attempt_at = now() + make_interval(secs => $4),
                    dead_lettered_at = case when $5::boolean then now() else null end
              where id = $1`,
            [row.id, attempts, messageOf(error), backoffSeconds(attempts), isDead],
          );

          this.logger.warn(
            { eventId: row.id, type: row.type, attempts, deadLettered: isDead },
            isDead ? 'evento em dead-letter' : 'falha ao publicar evento; nova tentativa agendada',
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }

    return { published, failed, deadLettered };
  }

  start(): void {
    if (this.timer !== undefined) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    // Deixa a rodada em curso terminar, para não cortar um COMMIT pela metade.
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.publishBatch();
    } catch (error) {
      this.logger.error({ err: error }, 'falha na varredura da outbox');
    } finally {
      this.running = false;
    }
  }
}

/** 2 s, 4 s, 8 s… até o teto de uma hora. */
export function backoffSeconds(attempts: number): number {
  return Math.min(BACKOFF_BASE_SECONDS ** attempts, BACKOFF_CAP_SECONDS);
}

function toEnvelope(row: PendingRow): EventEnvelope {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    payload: row.payload,
    occurredAt: row.occurred_at,
  };
}

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

async function rollbackQuietly(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // o erro que importa é o original
  }
}
